import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  MagnifyingGlass,
  Plus,
  Warning
} from '@phosphor-icons/react'
import type { ServerType } from '@shared/types'
import {
  SERVER_COMMAND_CATEGORIES,
  renderCommand,
  snippetsForServer,
  type ServerCommandCategory,
  type ServerCommandField,
  type ServerCommandSnippet
} from '@shared/serverCommands'
import { Badge, Card, Input, Select } from './ui/primitives'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

const PLAYER_SELECTORS = ['@a', '@p', '@r', '@s', '@e']

export function ServerCommandSnippets({
  serverType,
  players,
  onInsert
}: {
  serverType: ServerType
  players: string[]
  onInsert: (command: string) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | ServerCommandCategory>('all')
  const [selected, setSelected] = useState<ServerCommandSnippet | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const snippets = useMemo(() => snippetsForServer(serverType), [serverType])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return snippets.filter((snippet) => {
      if (category !== 'all' && snippet.category !== category) return false
      if (!needle) return true
      return `${snippet.label} ${snippet.description} ${snippet.command} ${snippet.category} ${snippet.id}`
        .toLowerCase()
        .includes(needle)
    })
  }, [snippets, query, category])

  const open = (snippet: ServerCommandSnippet): void => {
    setSelected(snippet)
    setValues(defaultValues(snippet.fields))
  }

  const rendered = selected ? renderCommand(selected, values) : ''
  const missing = selected
    ? (selected.fields ?? []).filter(
        (field) => field.required !== false && !(values[field.key] ?? '').trim()
      )
    : []
  const canInsert = Boolean(selected) && missing.length === 0

  return (
    <Card className="flex h-[660px] flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-grass/20 bg-grass/10 text-grass">
          <MagnifyingGlass size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[14px] font-semibold text-ink">Command snippets</h2>
          <p className="mt-0.5 text-[10px] text-muted">
            {selected ? 'Fill in the fields, then insert into the console.' : `${snippets.length} ready-made commands with player pickers.`}
          </p>
        </div>
      </div>

      {selected ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-2 inline-flex w-fit items-center gap-1 text-[10.5px] text-muted hover:text-ink"
          >
            <ArrowLeft size={12} /> All snippets
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-display text-[13px] font-semibold text-ink">{selected.label}</h3>
              <Badge tone="neutral" className="h-4 px-1.5 text-[8px]">
                {selected.category}
              </Badge>
              {selected.danger && (
                <Badge tone="red" className="h-4 px-1.5 text-[8px]">
                  Careful
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted/80">
              {selected.description}
            </p>

            {selected.fields && selected.fields.length > 0 && (
              <div className="mt-3 space-y-3">
                <datalist id="newbie-command-players">
                  {PLAYER_SELECTORS.map((selector) => (
                    <option key={selector} value={selector} />
                  ))}
                  {players.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {selected.fields.map((field) => (
                  <SnippetFieldInput
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    players={players}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ))}
              </div>
            )}

            <div className="mt-3 rounded-xl border border-line/45 bg-canvas/40 p-3">
              <div className="text-[9px] uppercase tracking-[0.1em] text-muted/60">Preview</div>
              <code className="mt-1 block break-all font-mono text-[10.5px] leading-relaxed text-ink/85">
                {rendered || 'Fill in the required fields'}
              </code>
            </div>

            {selected.danger && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[10px] leading-relaxed text-danger">
                <Warning size={13} className="mt-0.5 shrink-0" />
                This command can remove players, entities or server access. Review the preview and target before
                sending.
              </div>
            )}
            {missing.length > 0 && (
              <div className="mt-2 text-[10px] text-gold">
                Choose a value for: {missing.map((field) => field.label).join(', ')}
              </div>
            )}
          </div>

          <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-line/40 pt-3">
            <Button
              variant="primary"
              size="sm"
              disabled={!canInsert}
              onClick={() => {
                if (canInsert) onInsert(rendered)
              }}
              icon={<Plus size={14} />}
            >
              Insert into console
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands, e.g. give, tps, worldborder…"
              aria-label="Search command snippets"
            />
            <Select
              value={category}
              onChange={(value) => setCategory(value as 'all' | ServerCommandCategory)}
            >
              <option value="all">All categories</option>
              {SERVER_COMMAND_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line/50 p-4 text-[11px] text-muted">
                No snippets match that search.
              </div>
            ) : (
              filtered.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  onClick={() => open(snippet)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg border border-line/40 bg-canvas/20 px-2.5 py-2 text-left transition',
                    'hover:border-grass/30 hover:bg-canvas/50'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-medium text-ink">{snippet.label}</span>
                      {snippet.danger && <Warning size={11} className="text-danger/70" />}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9.5px] text-muted/60">
                      {snippet.command}
                    </span>
                  </span>
                  <Plus size={13} className="mt-1 shrink-0 text-muted/50" />
                </button>
              ))
            )}
          </div>
          <div className="mt-2 shrink-0 border-t border-line/40 pt-2 text-[9.5px] text-muted/55">
            {filtered.length} snippet{filtered.length === 1 ? '' : 's'} · {players.length} player
            {players.length === 1 ? '' : 's'} online
          </div>
        </>
      )}
    </Card>
  )
}

function SnippetFieldInput({
  field,
  value,
  players,
  onChange
}: {
  field: ServerCommandField
  value: string
  players: string[]
  onChange: (value: string) => void
}) {
  const listId =
    field.kind === 'player' || field.kind === 'target'
      ? 'newbie-command-players'
      : field.suggestions?.length
        ? `newbie-command-${field.key}`
        : undefined

  return (
    <div>
      <div className="text-[11px] font-medium text-ink">
        {field.label}
        {field.required === false && <span className="ml-1 font-normal text-muted/60">optional</span>}
      </div>
      <div className="mt-1">
        {field.kind === 'select' ? (
          <Select value={value} onChange={onChange}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : field.kind === 'number' ? (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input
            value={value}
            list={listId}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              field.kind === 'player' || field.kind === 'target'
                ? 'Player name or @p/@a/@r'
                : field.placeholder
            }
            className={field.kind === 'player' || field.kind === 'target' ? 'font-mono' : undefined}
          />
        )}
      </div>
      {(field.kind === 'player' || field.kind === 'target') && (
        <div className="mt-1 text-[9.5px] text-muted/60">
          {players.length > 0
            ? `Online: ${players.join(', ')}`
            : 'No players detected yet. Type a name or use @p, @a, @r, @s.'}
        </div>
      )}
      {field.suggestions && field.kind !== 'player' && field.kind !== 'target' && (
        <datalist id={`newbie-command-${field.key}`}>
          {field.suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  )
}

function defaultValues(fields?: ServerCommandField[]): Record<string, string> {
  if (!fields) return {}
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.defaultValue ??
        (field.kind === 'select' ? field.options?.[0]?.value ?? '' : field.kind === 'coordinates' ? '~ ~ ~' : '')
    ])
  )
}
