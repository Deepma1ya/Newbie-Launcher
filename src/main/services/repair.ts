import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Instance, RepairIssue, RepairReport } from '@shared/types'
import { store } from './store'
import { metadataLoaderMatches, readJarMeta, type JarMeta } from './jarMeta'
import { installAddon, persistInstance } from './addons'
import { ensureAddonFile } from './loadouts'
import { searchModrinth } from './modrinth'
import { zipPaths } from '../util/archive'
import { paths } from './paths'
import { pathExists, safeJoin, uniqueId } from '../util/fs'
import { logger } from '../util/log'

interface ScannedMod {
  /** Active or disabled filename without the .disabled suffix. */
  filename: string
  /** Path relative to the game directory, including mods/ and any .disabled suffix. */
  relative: string
  /** Absolute path on disk. */
  path: string
  meta: JarMeta
  disabled: boolean
  corrupt: boolean
}

/**
 * Mods that must stay enabled whenever possible. This is intentionally a
 * curated list of loader APIs, config libraries and core performance mods.
 * Repair will never choose one of these as the mod to disable in a conflict.
 */
const ESSENTIAL_MOD_IDS = new Set([
  'fabric-api',
  'fabric-language-kotlin',
  'quilted-fabric-api',
  'quilted_fabric_api',
  'qsl',
  'sodium',
  'embeddium',
  'rubidium',
  'iris',
  'oculus',
  'indium',
  'lithium',
  'ferritecore',
  'krypton',
  'modernfix',
  'immediatelyfast',
  'entityculling',
  'c2me',
  'noisium',
  'threadtweak',
  'badoptimizations',
  'memoryleakfix',
  'debugify',
  'cloth-config',
  'architectury',
  'forgeconfigapiport',
  'forge-config-api-port',
  'yacl',
  'yet_another_config_lib_v3',
  'modmenu'
])

const ESSENTIAL_ID_PREFIXES = ['fabric-api-']

function modIds(mod: ScannedMod): string[] {
  return [mod.meta.modId, ...mod.meta.provided].map((id) => id.toLowerCase())
}

function isEssentialMod(mod: ScannedMod): boolean {
  return modIds(mod).some(
    (id) => ESSENTIAL_MOD_IDS.has(id) || ESSENTIAL_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
  )
}

/**
 * A mod is protected when it is essential or when another active mod requires
 * it. Protected mods are kept out of conflict-disable choices; if both sides
 * are protected, Repair reports a manual conflict instead.
 */
function isProtectedMod(mod: ScannedMod, activeMods: ScannedMod[]): boolean {
  if (isEssentialMod(mod)) return true
  const ids = modIds(mod)
  return activeMods.some(
    (other) =>
      other.relative !== mod.relative &&
      other.meta.dependencies.some((dependency) => {
        if (!dependency.required || dependency.incompatible) return false
        return ids.includes(dependency.id.toLowerCase())
      })
  )
}

type RepairAction =
  | { type: 'disable'; relative: string; recordId?: string }
  | { type: 'enable'; recordId: string }
  | { type: 'enable-file'; relative: string }
  | { type: 'install-dependency'; dependencyId: string }
  | { type: 'restore'; recordId: string }
  | { type: 'clean-state'; recordId: string; keepActive: boolean }

interface RepairPlan {
  issues: RepairIssue[]
  actions: Map<string, RepairAction[]>
  /** Last-resort actions used only when the primary (non-destructive) fix fails. */
  fallbacks: Map<string, RepairAction[]>
  blocked: number
}

interface ApplyResult {
  fixed: number
  failed: number
  failedFingerprints: Set<string>
  fallbackFingerprints: Set<string>
}

export async function repairInstance(
  instanceId: string,
  apply: boolean,
  allowDisable = true,
  reuseBackup?: string
): Promise<RepairReport> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')

  const plan = await buildRepairPlan(instance, new Set())
  if (!apply) return makeReport(instanceId, plan, 0, 0, undefined)

  const actionCount = plan.issues
    .filter((issue) => issue.autoFixable && (allowDisable || !issue.requiresDisable))
    .reduce((total, issue) => total + (plan.actions.get(issue.id)?.length ?? 0), 0)
  if (actionCount === 0) {
    await pruneRepairFailures(instance, plan.issues)
    return makeReport(instanceId, plan, 0, 0, undefined)
  }

  let backupPath: string | undefined
  if (reuseBackup && isRepairBackup(reuseBackup) && (await pathExists(reuseBackup))) {
    // The safe pass already archived this instance; reuse it for the confirmed disable pass.
    backupPath = reuseBackup
  } else {
    backupPath = path.join(
      paths.repairBackups,
      `${instance.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    )
    try {
      await zipPaths(instance.gameDir, ['mods', 'resourcepacks', 'shaderpacks'], backupPath)
    } catch (error) {
      logger.warn('repair', 'Could not create repair backup', error)
      backupPath = undefined
    }
  }

  const applied = await applyPlan(instance, plan, allowDisable)
  const after = await buildRepairPlan(instance, applied.failedFingerprints)
  markPendingFallbacks(after, applied.fallbackFingerprints)
  await pruneRepairFailures(instance, after.issues)
  const skipped = after.issues.filter((issue) => !issue.autoFixable).length
  logger.info(
    'repair',
    `Repair for ${instance.name}: ${plan.issues.length} issue(s), ${applied.fixed} fixed, ${applied.failed} failed, ${skipped} manual`
  )
  return makeReport(instanceId, after, applied.fixed, applied.failed, backupPath)
}

export async function clearRepairFailures(instanceId: string): Promise<void> {
  const instance = store.instance(instanceId)
  if (!instance) throw new Error('Instance not found')
  instance.repairFailures = {}
  await persistInstance(instance)
}

function makeReport(
  instanceId: string,
  plan: RepairPlan,
  fixed: number,
  failed: number,
  backupPath?: string
): RepairReport {
  return {
    instanceId,
    scannedAt: new Date().toISOString(),
    issues: plan.issues,
    fixed,
    failed,
    blocked: plan.blocked,
    pendingDisables: plan.issues.filter((issue) => issue.autoFixable && issue.requiresDisable).length,
    skipped: plan.issues.filter((issue) => !issue.autoFixable).length,
    backupPath
  }
}

async function pruneRepairFailures(instance: Instance, issues: RepairIssue[]): Promise<void> {
  const current = new Set(issues.map(issueFingerprint))
  let pruned = false
  for (const fingerprint of Object.keys(instance.repairFailures ?? {})) {
    if (current.has(fingerprint)) continue
    delete instance.repairFailures![fingerprint]
    pruned = true
  }
  if (pruned) await persistInstance(instance)
}

async function buildRepairPlan(instance: Instance, failedFingerprints: Set<string>): Promise<RepairPlan> {
  const plan: RepairPlan = { issues: [], actions: new Map(), fallbacks: new Map(), blocked: 0 }
  const persistedFailures = instance.repairFailures ?? {}
  const push = (
    issue: Omit<RepairIssue, 'id'>,
    actions: RepairAction[],
    fallbacks: RepairAction[] = []
  ): void => addIssue(plan, failedFingerprints, persistedFailures, issue, actions, fallbacks)
  const scanned = await scanMods(instance)
  const active = scanned.filter((mod) => !mod.disabled && !mod.corrupt)
  const disabled = scanned.filter((mod) => mod.disabled && !mod.corrupt)
  const corruptActive = scanned.filter((mod) => !mod.disabled && mod.corrupt)
  const plannedDisabled = new Set<string>()
  const managedFilenames = new Set(
    instance.addons.filter((record) => record.type === 'mod').map((record) => record.filename.toLowerCase())
  )
  if (instance.tlsCapeFile) {
    managedFilenames.add(path.basename(instance.tlsCapeFile).toLowerCase())
  }

  for (const mod of corruptActive) {
    plannedDisabled.add(mod.relative)
    push(
      {
        kind: 'corrupt',
        severity: 'error',
        title: `${path.basename(mod.relative)} is not a readable mod file`,
        detail: 'The file could not be opened as a mod archive. It will be disabled so the loader cannot crash on it.',
        files: [mod.relative],
        autoFixable: true,
        requiresDisable: true,
        fixLabel: 'Disable unreadable file'
      },
      [{ type: 'disable', relative: mod.relative, recordId: recordIdForRelative(instance, mod.relative) }]
    )
  }

  const byModId = new Map<string, ScannedMod[]>()
  for (const mod of active) {
    if (plannedDisabled.has(mod.relative)) continue
    const key = mod.meta.modId.toLowerCase()
    const list = byModId.get(key) ?? []
    list.push(mod)
    byModId.set(key, list)
  }

  for (const [modId, duplicates] of byModId) {
    if (duplicates.length <= 1) continue
    const sorted = [...duplicates].sort((a, b) => {
      const aManaged = managedFilenames.has(a.filename.toLowerCase()) ? 0 : 1
      const bManaged = managedFilenames.has(b.filename.toLowerCase()) ? 0 : 1
      if (aManaged !== bManaged) return aManaged - bManaged
      const versionDiff = compareVersions(b.meta.version, a.meta.version)
      if (versionDiff !== 0) return versionDiff
      return a.filename.localeCompare(b.filename)
    })
    const keep = sorted[0]!
    const remove = sorted.slice(1)
    for (const mod of remove) plannedDisabled.add(mod.relative)
    push(
      {
        kind: 'duplicate',
        severity: 'error',
        title: `Duplicate ${keep.meta.name}`,
        detail: `${duplicates.length} copies of ${modId} are installed. Keeping ${keep.meta.version}; ${remove
          .map((mod) => mod.meta.version)
          .join(', ')} will be disabled.`,
        files: remove.map((mod) => mod.relative),
        autoFixable: true,
        requiresDisable: true,
        fixLabel: 'Keep newest and disable duplicates'
      },
      remove.map((mod) => ({
        type: 'disable' as const,
        relative: mod.relative,
        recordId: recordIdForRelative(instance, mod.relative)
      }))
    )
  }

  for (const mod of active) {
    if (plannedDisabled.has(mod.relative)) continue
    if (metadataLoaderMatches(mod.meta, instance.loader)) continue
    plannedDisabled.add(mod.relative)
    push(
      {
        kind: 'loader-mismatch',
        severity: 'error',
        title: `${mod.meta.name} is built for ${mod.meta.loader}`,
        detail: `This ${instance.loader} instance cannot load a ${mod.meta.loader} mod. It will be disabled.`,
        files: [mod.relative],
        autoFixable: true,
        requiresDisable: true,
        fixLabel: 'Disable incompatible mod'
      },
      [{ type: 'disable', relative: mod.relative, recordId: recordIdForRelative(instance, mod.relative) }]
    )
  }

  const conflictPairs = new Set<string>()
  for (const mod of active) {
    if (plannedDisabled.has(mod.relative)) continue
    for (const dependency of mod.meta.dependencies) {
      if (!dependency.incompatible) continue
      const other = active.find(
        (candidate) =>
          !plannedDisabled.has(candidate.relative) &&
          candidate.relative !== mod.relative &&
          candidate.meta.modId.toLowerCase() === dependency.id.toLowerCase()
      )
      if (!other) continue

      const pairKey = [mod.meta.modId.toLowerCase(), other.meta.modId.toLowerCase()].sort().join('|')
      if (conflictPairs.has(pairKey)) continue
      conflictPairs.add(pairKey)

      const modBreaksOther = declaresIncompatibility(mod, other)
      const otherBreaksMod = declaresIncompatibility(other, mod)
      const protectedPool = active.filter((candidate) => !plannedDisabled.has(candidate.relative))
      const modProtected = isProtectedMod(mod, protectedPool)
      const otherProtected = isProtectedMod(other, protectedPool)

      if (modProtected && otherProtected) {
        push(
          {
            kind: 'incompatible',
            severity: 'warning',
            title: `${mod.meta.name} conflicts with ${other.meta.name}`,
            detail:
              'The two mods declare an incompatibility, but both are essential or required by another active mod. Newbie will not disable either of them automatically. Resolve this manually by removing one of the conflicting mods.',
            files: [mod.relative, other.relative],
            autoFixable: false
          },
          []
        )
        continue
      }

      const loser = modProtected
        ? other
        : otherProtected
          ? mod
          : modBreaksOther && !otherBreaksMod
            ? other
            : otherBreaksMod && !modBreaksOther
              ? mod
              : lowerPriority(mod, other, managedFilenames)
      if (plannedDisabled.has(loser.relative)) continue
      plannedDisabled.add(loser.relative)
      const protectedNote =
        modProtected || otherProtected
          ? `${modProtected ? mod.meta.name : other.meta.name} is essential or required by another active mod, so it is kept enabled. `
          : ''
      push(
        {
          kind: 'incompatible',
          severity: 'error',
          title: `${mod.meta.name} conflicts with ${other.meta.name}`,
          detail: `${protectedNote}The two mods declare an incompatibility. ${
            modBreaksOther && otherBreaksMod && !modProtected && !otherProtected
              ? 'This is mutual; Newbie keeps the higher-priority mod. '
              : ''
          }Disabling ${loser.meta.name}.`,
          files: [loser.relative],
          autoFixable: true,
          requiresDisable: true,
          fixLabel: 'Disable conflicting mod'
        },
        [{ type: 'disable', relative: loser.relative, recordId: recordIdForRelative(instance, loser.relative) }]
      )
    }
  }

  const remainingActive = active.filter((mod) => !plannedDisabled.has(mod.relative))
  const activeIds = idsOf(remainingActive)
  const unavailable = [...disabled, ...active.filter((mod) => plannedDisabled.has(mod.relative))]
  const disabledIds = idsOf(unavailable)

  const missing = new Map<string, { dependents: ScannedMod[]; ranges: Set<string> }>()
  const disabledDependencies = new Map<
    string,
    { dependents: ScannedMod[]; provider?: ScannedMod; safeToEnable: boolean }
  >()
  for (const mod of remainingActive) {
    for (const dependency of mod.meta.dependencies) {
      if (!dependency.required || isIgnoredDependency(dependency.id)) continue
      const id = dependency.id.toLowerCase()
      if (activeIds.has(id)) continue
      if (disabledIds.has(id)) {
        const entry = disabledDependencies.get(id) ?? { dependents: [], safeToEnable: false }
        entry.dependents.push(mod)
        entry.provider =
          entry.provider ??
          unavailable.find(
            (candidate) =>
              candidate.meta.modId.toLowerCase() === id ||
              candidate.meta.provided.some((provided) => provided.toLowerCase() === id)
          )
        const provider = entry.provider
        entry.safeToEnable =
          Boolean(provider) &&
          Boolean(provider?.disabled) &&
          !plannedDisabled.has(provider!.relative) &&
          metadataLoaderMatches(provider!.meta, instance.loader) &&
          !remainingActive.some(
            (activeMod) =>
              declaresIncompatibility(activeMod, provider!) || declaresIncompatibility(provider!, activeMod)
          )
        disabledDependencies.set(id, entry)
      } else {
        const entry = missing.get(id) ?? { dependents: [], ranges: new Set<string>() }
        entry.dependents.push(mod)
        if (dependency.versionRange) entry.ranges.add(dependency.versionRange)
        missing.set(id, entry)
      }
    }
  }

  for (const [id, entry] of missing) {
    const protectedDependents = entry.dependents.filter((mod) => isProtectedMod(mod, remainingActive))
    const fallbackDependents = entry.dependents.filter((mod) => !protectedDependents.includes(mod))
    const protectionNote = protectedDependents.length
      ? ` ${dependentNames(protectedDependents)} ${protectedDependents.length === 1 ? 'is' : 'are'} essential or required by another active mod, so ${protectedDependents.length === 1 ? 'it is' : 'they are'} left enabled.`
      : ''
    push(
      {
        kind: 'missing-dependency',
        severity: 'warning',
        title: `Missing dependency: ${id}`,
        detail: `Required by ${dependentNames(entry.dependents)}${
          entry.ranges.size ? ` (${[...entry.ranges].join(', ')})` : ''
        }. Newbie can try to install it from Modrinth.${protectionNote}`,
        files: (fallbackDependents.length > 0 ? fallbackDependents : entry.dependents).map(
          (mod) => mod.relative
        ),
        autoFixable: true,
        fixLabel: 'Install missing dependency'
      },
      [{ type: 'install-dependency', dependencyId: id }],
      fallbackDependents.map((mod) => ({
        type: 'disable' as const,
        relative: mod.relative,
        recordId: recordIdForRelative(instance, mod.relative)
      }))
    )
  }

  for (const [id, entry] of disabledDependencies) {
    const providerName = entry.provider?.meta.name ?? id
    const recordId = entry.provider ? recordIdForRelative(instance, entry.provider.relative) : undefined
    push(
      {
        kind: 'disabled-dependency',
        severity: 'warning',
        title: `Dependency ${id} is disabled`,
        detail: entry.safeToEnable
          ? `${providerName} is present but disabled. Newbie can enable it to satisfy ${dependentNames(
              entry.dependents
            )}.`
          : `${providerName} is disabled and conflicts with an active mod. Enable it manually only if you know it is compatible, or remove the dependent mod.`,
        files: entry.dependents.map((mod) => mod.relative),
        autoFixable: entry.safeToEnable,
        fixLabel: entry.safeToEnable ? 'Enable dependency' : undefined
      },
      entry.safeToEnable && entry.provider
        ? [
            recordId
              ? { type: 'enable' as const, recordId }
              : { type: 'enable-file' as const, relative: entry.provider.relative }
          ]
        : []
    )
  }

  await addRecordStateIssues(instance, plan, failedFingerprints, plannedDisabled)
  return plan
}

async function addRecordStateIssues(
  instance: Instance,
  plan: RepairPlan,
  failedFingerprints: Set<string>,
  plannedDisabled: Set<string>
): Promise<void> {
  const persistedFailures = instance.repairFailures ?? {}
  const push = (issue: Omit<RepairIssue, 'id'>, actions: RepairAction[]): void =>
    addIssue(plan, failedFingerprints, persistedFailures, issue, actions)
  const loadout = instance.loadouts.find((entry) => entry.id === instance.activeLoadoutId)
  const expected = new Set(loadout?.addonIds ?? [])
  for (const record of instance.addons) {
    if (record.type !== 'mod' || !expected.has(record.id)) continue
    if (plannedDisabled.has(`mods/${record.filename}`)) continue
    const active = path.join(instance.gameDir, 'mods', record.filename)
    const disabled = `${active}.disabled`
    const [hasActive, hasDisabled] = await Promise.all([pathExists(active), pathExists(disabled)])

    if (!hasActive && !hasDisabled) {
      const downloadable = record.provider === 'modrinth' && record.enabled
      push(
        {
          kind: 'corrupt',
          severity: 'warning',
          title: `${record.name} is missing its file`,
          detail: downloadable
            ? 'The add-on is in the active loadout but its file is gone. Newbie can download it again from Modrinth.'
            : 'The add-on is in the active loadout but its file is gone. Reinstall it to restore the loadout.',
          files: [record.filename],
          autoFixable: downloadable,
          fixLabel: downloadable ? 'Re-download add-on' : undefined
        },
        downloadable ? [{ type: 'restore', recordId: record.id }] : []
      )
      continue
    }

    if (hasActive && hasDisabled) {
      push(
        {
          kind: 'state-mismatch',
          severity: 'warning',
          title: `${record.name} has two copies`,
          detail: `Both an active and disabled copy exist. Newbie keeps the ${
            record.enabled ? 'active' : 'disabled'
          } copy and moves the other one aside.`,
          files: [record.filename],
          autoFixable: true,
          fixLabel: 'Resolve add-on state'
        },
        [{ type: 'clean-state', recordId: record.id, keepActive: record.enabled }]
      )
      continue
    }

    if (!hasActive && hasDisabled && record.enabled) {
      push(
        {
          kind: 'state-mismatch',
          severity: 'warning',
          title: `${record.name} is marked enabled but disabled on disk`,
          detail: 'The add-on is in the active loadout and marked enabled, so the disabled copy will be restored.',
          files: [record.filename],
          autoFixable: true,
          fixLabel: 'Enable add-on'
        },
        [{ type: 'enable', recordId: record.id }]
      )
      continue
    }

    if (hasActive && !hasDisabled && !record.enabled) {
      push(
        {
          kind: 'state-mismatch',
          severity: 'warning',
          title: `${record.name} is marked disabled but active on disk`,
          detail: 'The add-on is marked disabled, so the active file will be disabled to match the add-on state.',
          files: [record.filename],
          autoFixable: true,
          requiresDisable: true,
          fixLabel: 'Disable add-on'
        },
        [
          {
            type: 'disable',
            relative: `mods/${record.filename}`,
            recordId: record.id
          }
        ]
      )
    }
  }
}

async function applyPlan(instance: Instance, plan: RepairPlan, allowDisable: boolean): Promise<ApplyResult> {
  let fixed = 0
  let failed = 0
  const failedFingerprints = new Set<string>()
  const fallbackFingerprints = new Set<string>()
  const disabledRecordIds = new Set<string>()

  // Dependencies, enables and restores must run before the user-confirmed disables.
  const orderedIssues = [...plan.issues].sort(
    (a, b) => Number(Boolean(a.requiresDisable)) - Number(Boolean(b.requiresDisable))
  )

  for (const issue of orderedIssues) {
    if (!issue.autoFixable) continue
    if (issue.requiresDisable && !allowDisable) continue
    const actions = plan.actions.get(issue.id) ?? []
    if (actions.length === 0) continue

    const primary = await runActions(instance, actions, disabledRecordIds, issue.title)
    if (primary.resolved && !primary.failed) {
      fixed += 1
      delete instance.repairFailures?.[issueFingerprint(issue)]
      continue
    }

    const fallbacks = plan.fallbacks.get(issue.id) ?? []
    if (fallbacks.length > 0) {
      if (!allowDisable) {
        // Do not persist this as a failure. The UI offers a confirmed disable instead.
        fallbackFingerprints.add(issueFingerprint(issue))
        continue
      }
      const fallback = await runActions(
        instance,
        fallbacks,
        disabledRecordIds,
        `${issue.title} (disable dependent mods)`
      )
      if (fallback.resolved && !fallback.failed) {
        fixed += 1
        delete instance.repairFailures?.[issueFingerprint(issue)]
        continue
      }
    }

    failed += 1
    const fingerprint = issueFingerprint(issue)
    failedFingerprints.add(fingerprint)
    instance.repairFailures = {
      ...(instance.repairFailures ?? {}),
      [fingerprint]: { at: new Date().toISOString(), message: issue.title }
    }
  }

  await syncRecordState(instance, disabledRecordIds)
  return { fixed, failed, failedFingerprints, fallbackFingerprints }
}

async function runActions(
  instance: Instance,
  actions: RepairAction[],
  disabledRecordIds: Set<string>,
  label: string
): Promise<{ resolved: boolean; failed: boolean }> {
  let resolved = false
  let actionFailed = false
  for (const action of actions) {
    try {
      const ok = await applyAction(instance, action)
      if (ok) {
        resolved = true
        if (action.type === 'disable' && action.recordId) disabledRecordIds.add(action.recordId)
      } else {
        actionFailed = true
      }
    } catch (error) {
      actionFailed = true
      logger.warn('repair', `Could not apply repair: ${label}`, error)
    }
  }
  return { resolved, failed: actionFailed }
}

async function applyAction(instance: Instance, action: RepairAction): Promise<boolean> {
  switch (action.type) {
    case 'disable':
      return disableFile(instance, action.relative)
    case 'enable':
      return enableRecord(instance, action.recordId)
    case 'enable-file':
      return enableFile(instance, action.relative)
    case 'install-dependency':
      return tryInstallDependency(instance, action.dependencyId)
    case 'restore':
      return restoreRecord(instance, action.recordId)
    case 'clean-state':
      return cleanRecordState(instance, action.recordId, action.keepActive)
  }
}

async function disableFile(instance: Instance, relative: string): Promise<boolean> {
  const active = safeJoin(instance.gameDir, relative)
  const disabled = `${active}.disabled`
  if (!(await pathExists(active))) {
    // The desired end state is already present if the disabled copy exists.
    return pathExists(disabled)
  }
  if (await pathExists(disabled)) {
    // Never silently skip a disable because a stale disabled file exists.
    await moveAside(disabled)
  }
  await fs.rename(active, disabled)
  return true
}

async function enableRecord(instance: Instance, recordId: string): Promise<boolean> {
  const record = instance.addons.find((entry) => entry.id === recordId)
  if (!record) return false
  const active = path.join(instance.gameDir, 'mods', record.filename)
  const disabled = `${active}.disabled`
  if (!(await pathExists(disabled))) return pathExists(active)
  if (await pathExists(active)) {
    await moveAside(disabled)
    return true
  }
  await fs.rename(disabled, active)
  return true
}

async function enableFile(instance: Instance, relative: string): Promise<boolean> {
  const disabled = safeJoin(instance.gameDir, relative)
  const active = disabled.replace(/\.disabled$/i, '')
  if (!(await pathExists(disabled))) return pathExists(active)
  if (await pathExists(active)) {
    await moveAside(disabled)
    return true
  }
  await fs.rename(disabled, active)
  return true
}

async function restoreRecord(instance: Instance, recordId: string): Promise<boolean> {
  const record = instance.addons.find((entry) => entry.id === recordId)
  if (!record) return false
  await ensureAddonFile(instance, record)
  return pathExists(path.join(instance.gameDir, 'mods', record.filename))
}

async function cleanRecordState(instance: Instance, recordId: string, keepActive: boolean): Promise<boolean> {
  const record = instance.addons.find((entry) => entry.id === recordId)
  if (!record) return false
  const active = path.join(instance.gameDir, 'mods', record.filename)
  const disabled = `${active}.disabled`
  const [hasActive, hasDisabled] = await Promise.all([pathExists(active), pathExists(disabled)])
  if (keepActive) {
    if (hasDisabled) await moveAside(disabled)
    return hasActive || (await pathExists(active))
  }
  if (hasActive) {
    if (hasDisabled) {
      await moveAside(active)
      return true
    }
    await fs.rename(active, disabled)
    return true
  }
  return hasDisabled
}

async function syncRecordState(instance: Instance, disabledRecordIds: Set<string>): Promise<void> {
  for (const record of instance.addons) {
    if (record.type !== 'mod') continue
    const active = path.join(instance.gameDir, 'mods', record.filename)
    const disabled = `${active}.disabled`
    const [hasActive, hasDisabled] = await Promise.all([pathExists(active), pathExists(disabled)])
    if (hasActive && hasDisabled) {
      // The record's enabled flag decides which copy is authoritative.
      if (record.enabled) await moveAside(disabled)
      else await moveAside(active)
      record.enabled = await pathExists(active)
    } else if (hasActive) {
      record.enabled = true
    } else if (hasDisabled) {
      record.enabled = false
    }
  }

  if (disabledRecordIds.size > 0) {
    const loadout = instance.loadouts.find((entry) => entry.id === instance.activeLoadoutId)
    if (loadout) {
      loadout.addonIds = loadout.addonIds.filter((id) => !disabledRecordIds.has(id))
      loadout.updatedAt = new Date().toISOString()
    }
  }
  await persistInstance(instance)
}

async function tryInstallDependency(instance: Instance, dependencyId: string): Promise<boolean> {
  try {
    const page = await searchModrinth({
      query: dependencyId,
      type: 'mod',
      gameVersion: instance.versionId,
      loader: instance.loader,
      limit: 12
    })
    const target = normalizedDependencyId(dependencyId)
    const hit = page.hits.find((candidate) => {
      const values = [candidate.slug, candidate.title].filter((value): value is string => Boolean(value))
      return values.some((value) => normalizedDependencyId(value) === target)
    })
    if (!hit) return false
    await installAddon(instance.id, { projectId: hit.project_id, versionId: '' })
    const after = await scanMods(instance)
    return idsOf(after.filter((mod) => !mod.disabled && !mod.corrupt)).has(dependencyId.toLowerCase())
  } catch (error) {
    logger.warn('repair', `Could not auto-install dependency ${dependencyId}`, error)
    return false
  }
}

async function scanMods(instance: Instance): Promise<ScannedMod[]> {
  const dir = path.join(instance.gameDir, 'mods')
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: ScannedMod[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const disabled = /\.disabled$/i.test(entry.name)
    const base = disabled ? entry.name.replace(/\.disabled$/i, '') : entry.name
    if (!/\.(jar|zip)$/i.test(base)) continue
    const file = path.join(dir, entry.name)
    const meta = readJarMeta(file)
    result.push({
      filename: base,
      relative: `mods/${entry.name}`,
      path: file,
      meta: meta ?? fallbackMeta(entry.name),
      disabled,
      corrupt: !meta
    })
  }
  return result
}

function fallbackMeta(filename: string): JarMeta {
  const base = filename.replace(/\.(jar|zip)(\.disabled)?$/i, '')
  return {
    loader: 'unknown',
    modId: base,
    name: base,
    version: 'unknown',
    dependencies: [],
    entries: [],
    provided: []
  }
}

function idsOf(mods: ScannedMod[]): Set<string> {
  const ids = new Set<string>()
  for (const mod of mods) {
    if (mod.corrupt) continue
    ids.add(mod.meta.modId.toLowerCase())
    for (const provided of mod.meta.provided) ids.add(provided.toLowerCase())
  }
  return ids
}

function declaresIncompatibility(from: ScannedMod, to: ScannedMod): boolean {
  return from.meta.dependencies.some(
    (dependency) =>
      dependency.incompatible && dependency.id.toLowerCase() === to.meta.modId.toLowerCase()
  )
}

function lowerPriority(a: ScannedMod, b: ScannedMod, managed: Set<string>): ScannedMod {
  const aManaged = managed.has(a.filename.toLowerCase())
  const bManaged = managed.has(b.filename.toLowerCase())
  if (aManaged !== bManaged) return aManaged ? b : a
  const versionDiff = compareVersions(a.meta.version, b.meta.version)
  if (versionDiff !== 0) return versionDiff < 0 ? a : b
  return a.filename.localeCompare(b.filename) > 0 ? a : b
}

function recordIdForRelative(instance: Instance, relative: string): string | undefined {
  const filename = path.basename(relative).replace(/\.disabled$/i, '').toLowerCase()
  return instance.addons.find(
    (record) => record.type === 'mod' && record.filename.toLowerCase() === filename
  )?.id
}

function dependentNames(mods: ScannedMod[]): string {
  return mods.map((mod) => mod.meta.name).join(', ')
}

function normalizedDependencyId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/api$/, '')
}

function isIgnoredDependency(id: string): boolean {
  return ['minecraft', 'java', 'fabricloader', 'fabric', 'quilt_loader', 'forge', 'neoforge'].includes(
    id.toLowerCase()
  )
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((part) => Number(part) || 0)
  const pb = b.split(/[.+-]/).map((part) => Number(part) || 0)
  const length = Math.max(pa.length, pb.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function issueFingerprint(issue: RepairIssue): string {
  return `${issue.kind}|${issue.title}|${[...issue.files].sort().join(',')}`
}

function isRepairBackup(candidate: string): boolean {
  const resolved = path.resolve(candidate)
  const backupDir = path.resolve(paths.repairBackups)
  return path.dirname(resolved) === backupDir && path.basename(resolved).endsWith('.zip')
}

async function moveAside(file: string): Promise<void> {
  const target = `${file}.newbie-backup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await fs.rename(file, target)
}

function markPendingFallbacks(plan: RepairPlan, fingerprints: Set<string>): void {
  if (fingerprints.size === 0) return
  for (const issue of plan.issues) {
    if (!fingerprints.has(issueFingerprint(issue))) continue
    const prefix = 'Missing dependency: '
    const dependencyId = issue.title.startsWith(prefix) ? issue.title.slice(prefix.length) : undefined
    issue.requiresDisable = true
    issue.autoFixable = true
    issue.fixLabel = 'Disable dependent mods'
    if (dependencyId) {
      issue.title = `Dependency ${dependencyId} could not be installed`
      issue.detail = `${issue.detail} Newbie could not download ${dependencyId} from Modrinth. Disabling the unprotected mods that require it is the last resort.`
    } else {
      issue.detail = `${issue.detail} Newbie could not install the dependency automatically, so the unprotected mods that require it can be disabled instead.`
    }
  }
}

function addIssue(
  plan: RepairPlan,
  failedFingerprints: Set<string>,
  persistedFailures: Record<string, { at: string; message?: string }>,
  issue: Omit<RepairIssue, 'id'>,
  actions: RepairAction[],
  fallbacks: RepairAction[] = []
): void {
  const withId: RepairIssue = { ...issue, id: uniqueId('issue') }
  const fingerprint = issueFingerprint(withId)
  const failedNow = failedFingerprints.has(fingerprint)
  const failedBefore = persistedFailures[fingerprint]
  if (failedNow || failedBefore) {
    if (failedBefore) plan.blocked += 1
    plan.issues.push({
      ...withId,
      autoFixable: false,
      fixLabel: undefined,
      detail: `${withId.detail} ${
        failedBefore
          ? `Automatic repair failed previously (${new Date(failedBefore.at).toLocaleDateString()}); fix it manually or use Retry automatic fixes.`
          : 'Automatic repair failed in this session; fix it manually.'
      }`
    })
    return
  }
  plan.issues.push(withId)
  if (withId.autoFixable && actions.length > 0) plan.actions.set(withId.id, actions)
  if (withId.autoFixable && fallbacks.length > 0) plan.fallbacks.set(withId.id, fallbacks)
}
