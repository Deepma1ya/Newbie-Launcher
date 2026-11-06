# Newbie Launcher - uninstall cleanup.
#
# Deletes every folder the launcher created and removes the Windows Defender
# exclusions that the installer or the app added.
#
# The launcher data folder can be moved, so the real location is read from
# Electron's bootstrap.json. The default folder is cleaned as well because a
# previous move leaves the old copy behind.
#
# Parameters:
#   -InstallDir  install folder (used for the Defender exclusion, never deleted here)
#   -PurgeData   "1" to delete game files and launcher data, "0" to keep them
#   -Status      text file with human readable result lines
#
# Exit codes: 0 = done, 1 = some files could not be deleted,
#             2 = Defender exclusions kept because UAC was cancelled,
#             3 = both.

[CmdletBinding()]
param(
  [string]$InstallDir = '',
  [string]$PurgeData = '1',
  [string]$Status = ''
)

$ErrorActionPreference = 'SilentlyContinue'
$failedRoots = New-Object System.Collections.Generic.List[string]

function Get-FullPath {
  param([string]$Value)
  if (-not $Value) { return '' }
  try {
    return [System.IO.Path]::GetFullPath($Value).TrimEnd('\')
  } catch {
    return ''
  }
}

function Test-SafeRoot {
  param([string]$Path)
  if (-not $Path) { return $false }
  if ($Path.Length -lt 4) { return $false }
  if ($Path -match '^[A-Za-z]:$') { return $false }

  $blocked = @(
    $env:USERPROFILE
    $env:APPDATA
    $env:LOCALAPPDATA
    (Join-Path $env:USERPROFILE 'AppData')
    $env:PUBLIC
    $env:ProgramData
    $env:ProgramFiles
    ${env:ProgramFiles(x86)}
    $env:SystemRoot
  )
  foreach ($entry in $blocked) {
    if (-not $entry) { continue }
    $full = Get-FullPath $entry
    if ($full -and [string]::Equals($Path, $full, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $false
    }
  }

  # Never delete a parent of the user profile or of the installed app.
  $profilePath = Get-FullPath $env:USERPROFILE
  if ($profilePath -and $profilePath.StartsWith($Path + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $false
  }
  $installPath = Get-FullPath $InstallDir
  if ($installPath -and $installPath.StartsWith($Path + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $false
  }
  return $true
}

$roots = New-Object System.Collections.Generic.List[string]
function Add-Root {
  param([string]$Candidate)
  $full = Get-FullPath $Candidate
  if (-not $full) { return }
  if (-not (Test-SafeRoot $full)) { return }
  foreach ($existing in $roots) {
    if ([string]::Equals($existing, $full, [System.StringComparison]::OrdinalIgnoreCase)) { return }
  }
  [void]$roots.Add($full)
}

function Add-ChildRoot {
  param([string]$Base, [string]$Name)
  if (-not $Base) { return }
  Add-Root (Join-Path $Base $Name)
}

# A moved data folder is only deleted when it still looks like launcher data.
# This keeps a damaged bootstrap.json from pointing the uninstaller at an
# unrelated folder.
function Test-LauncherData {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $true }
  foreach ($marker in @('launcher.json', 'instances', 'versions', 'libraries', 'assets', 'cache', 'logs', 'runtimes', 'bedrock', 'servers')) {
    if (Test-Path -LiteralPath (Join-Path $Path $marker)) { return $true }
  }
  return $false
}

$bootstrap = Join-Path $env:APPDATA 'newbie-launcher\bootstrap.json'
$dataDir = ''
if (Test-Path -LiteralPath $bootstrap) {
  try {
    $config = Get-Content -LiteralPath $bootstrap -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($config -and $config.dataDir) { $dataDir = [string]$config.dataDir }
  } catch {
  }
}
$defaultDataDir = Get-FullPath (Join-Path $env:APPDATA 'NewbieLauncher')
$customDataDir = Get-FullPath $dataDir
if ($customDataDir -and -not [string]::Equals($customDataDir, $defaultDataDir, [System.StringComparison]::OrdinalIgnoreCase)) {
  if (-not (Test-LauncherData $customDataDir)) { $dataDir = '' }
}

Add-Root $dataDir
Add-ChildRoot $env:APPDATA 'NewbieLauncher'
Add-ChildRoot $env:APPDATA 'newbie-launcher'
Add-ChildRoot $env:APPDATA 'Newbie Launcher'
Add-ChildRoot $env:LOCALAPPDATA 'newbie-launcher'
Add-ChildRoot $env:PUBLIC 'NewbieLauncher'

# The stamp is written only when exclusions were added successfully.
$stamps = @(
  (Join-Path $env:APPDATA 'NewbieLauncher\defender-exclusions.json')
  (Join-Path $env:APPDATA 'newbie-launcher\defender-exclusions.json')
)
if ($dataDir) { $stamps += (Join-Path $dataDir 'defender-exclusions.json') }
$hadExclusions = $false
foreach ($stamp in $stamps) {
  if (Test-Path -LiteralPath $stamp) { $hadExclusions = $true }
}

$exclusionState = 'none'
if ($hadExclusions -and $InstallDir) {
  $helper = Join-Path $PSScriptRoot 'defender-exclusions.ps1'
  if (Test-Path -LiteralPath $helper) {
    $resultFile = Join-Path $env:TEMP ('newbie-uninstall-defender-' + [System.Guid]::NewGuid().ToString('N') + '.json')
    $targets = New-Object System.Collections.Generic.List[string]
    $installPath = Get-FullPath $InstallDir
    if ($installPath) { [void]$targets.Add($installPath) }
    foreach ($root in $roots) { [void]$targets.Add($root) }

    $shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if (-not (Test-Path -LiteralPath $shell)) { $shell = 'powershell.exe' }
    & $shell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $helper -Mode remove -Paths ($targets -join '|') -Result $resultFile | Out-Null
    $exitCode = $LASTEXITCODE
    $detail = $null
    if (Test-Path -LiteralPath $resultFile) {
      try { $detail = Get-Content -LiteralPath $resultFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
      Remove-Item -LiteralPath $resultFile -Force -ErrorAction SilentlyContinue
    }

    if ($exitCode -eq 0) {
      $exclusionState = 'removed'
      foreach ($stamp in $stamps) { Remove-Item -LiteralPath $stamp -Force -ErrorAction SilentlyContinue }
    } elseif ($exitCode -eq 2 -or ($detail -and $detail.cancelled)) {
      $exclusionState = 'cancelled'
    } else {
      $exclusionState = 'failed'
    }
  } else {
    $exclusionState = 'failed'
  }
}

# Drop the high-performance GPU preference entries that point at Java runtimes
# inside the folders being deleted.
$gpuKey = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
if (Test-Path -LiteralPath $gpuKey) {
  $properties = Get-ItemProperty -LiteralPath $gpuKey -ErrorAction SilentlyContinue
  if ($properties) {
    foreach ($name in @($properties.PSObject.Properties.Name)) {
      if ($name -like 'PS*') { continue }
      foreach ($root in $roots) {
        if ($name.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
          Remove-ItemProperty -LiteralPath $gpuKey -Name $name -ErrorAction SilentlyContinue
          break
        }
      }
    }
  }
}

if ($PurgeData -eq '1') {
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    for ($attempt = 0; $attempt -lt 4; $attempt += 1) {
      Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path -LiteralPath $root)) { break }
      Start-Sleep -Milliseconds 350
    }
    if (Test-Path -LiteralPath $root) { [void]$failedRoots.Add($root) }
  }
}

# Helper files left in TEMP (Defender results, update payloads and so on).
Get-ChildItem -Path $env:TEMP -Filter 'newbie-*' -Force -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$lines = @()
if ($PurgeData -eq '1') {
  if ($failedRoots.Count -eq 0) {
    $lines += 'Game files, mods, worlds, servers, backups, caches and launcher settings were deleted.'
  } else {
    $lines += 'Some launcher files could not be deleted: ' + ($failedRoots -join '; ')
  }
} else {
  $lines += 'Launcher data was kept.'
}
if ($exclusionState -eq 'removed') {
  $lines += 'Windows Defender exclusions were removed.'
} elseif ($exclusionState -eq 'cancelled') {
  $lines += 'Windows Defender exclusions were kept because administrator approval was cancelled.'
} elseif ($exclusionState -eq 'failed') {
  $lines += 'Windows Defender exclusions could not be removed. Remove them manually in Windows Security.'
}

if ($Status) {
  try {
    $text = ($lines -join [Environment]::NewLine)
    [System.IO.File]::WriteAllText($Status, $text, (New-Object System.Text.UTF8Encoding($false)))
  } catch {
  }
}

if ($failedRoots.Count -gt 0) {
  if ($exclusionState -eq 'cancelled') { exit 3 }
  exit 1
}
if ($exclusionState -eq 'cancelled') { exit 2 }
exit 0
