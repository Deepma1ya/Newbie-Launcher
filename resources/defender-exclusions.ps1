# Newbie Launcher - Windows Defender exclusion helper.
#
# Adds or removes Defender exclusions for the folders the launcher installs
# into and downloads to. Add-MpPreference and Remove-MpPreference need an
# administrator, so the work runs in an elevated child process.
#
# Modes:
#   add     add the given folders
#   remove  remove the given folders
#
# Parameters:
#   -Paths   pipe separated list of folders
#   -Stamp   JSON file written after a successful add
#   -Result  JSON file describing the outcome
#
# Exit codes: 0 success, 1 failure, 2 administrator approval cancelled.

[CmdletBinding()]
param(
  [ValidateSet('add', 'remove')]
  [string]$Mode = 'add',
  [string]$Paths = '',
  [string]$Stamp = '',
  [string]$Result = ''
)

$ErrorActionPreference = 'Stop'

function Get-ElevatedPowerShell {
  $candidate = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  if (Test-Path -LiteralPath $candidate) { return $candidate }
  return 'powershell.exe'
}

function ConvertTo-Targets {
  param([string]$Value)
  $targets = New-Object System.Collections.ArrayList
  foreach ($piece in ($Value -split '\|')) {
    $candidate = $piece.Trim()
    if (-not $candidate) { continue }
    if ($candidate.Length -gt 3) { $candidate = $candidate.TrimEnd('\') }
    $seen = $false
    foreach ($existing in $targets) {
      if ([string]::Equals($existing, $candidate, [System.StringComparison]::OrdinalIgnoreCase)) {
        $seen = $true
        break
      }
    }
    if (-not $seen) { [void]$targets.Add($candidate) }
  }
  return @($targets)
}

function ConvertTo-Literal {
  param([string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function Save-Json {
  param([string]$Path, [object]$Payload)
  if (-not $Path) { return }
  try {
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
      New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
    $json = $Payload | ConvertTo-Json -Compress -Depth 4
    [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
  } catch {
    # A bookkeeping failure must not change the outcome of the mode.
  }
}

$targets = ConvertTo-Targets $Paths
if ($targets.Count -eq 0) {
  Save-Json $Result ([pscustomobject]@{ ok = $true; cancelled = $false; mode = $Mode; paths = @() })
  exit 0
}

$errorFile = ''
if ($Result) { $errorFile = $Result + '.error.txt' }

# The elevated child is built as plain text and passed with -EncodedCommand so
# paths containing quotes, spaces or non-ASCII characters cannot break parsing.
$actions = New-Object System.Collections.Generic.List[string]
$actions.Add('$ErrorActionPreference = ''Stop''')
$actions.Add('$targets = @(' + (($targets | ForEach-Object { ConvertTo-Literal $_ }) -join ', ') + ')')
$actions.Add('try {')
if ($Mode -eq 'remove') {
  $actions.Add('  foreach ($target in $targets) { Remove-MpPreference -ExclusionPath $target -ErrorAction SilentlyContinue }')
} else {
  $actions.Add('  foreach ($target in $targets) { Add-MpPreference -ExclusionPath $target -ErrorAction Stop }')
}
$actions.Add('  exit 0')
$actions.Add('} catch {')
if ($errorFile) {
  $actions.Add(
    '  try { [System.IO.File]::WriteAllText(' +
    (ConvertTo-Literal $errorFile) +
    ', $_.Exception.Message, (New-Object System.Text.UTF8Encoding($false))) } catch { }'
  )
}
$actions.Add('  exit 1')
$actions.Add('}')
$childScript = $actions -join "`r`n"

$encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($childScript))
$arguments = @(
  '-NoProfile'
  '-NonInteractive'
  '-ExecutionPolicy'
  'Bypass'
  '-WindowStyle'
  'Hidden'
  '-EncodedCommand'
  $encoded
)

$exitCode = 1
$cancelled = $false
try {
  $process = Start-Process -FilePath (Get-ElevatedPowerShell) -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait
  $exitCode = $process.ExitCode
} catch {
  $message = [string]$_.Exception.Message
  $nativeCode = 0
  if ($_.Exception -is [System.ComponentModel.Win32Exception]) {
    $nativeCode = $_.Exception.NativeErrorCode
  }
  if ($nativeCode -eq 1223 -or $message -match 'cancel|1223') {
    $cancelled = $true
  } else {
    $exitCode = 1
    if ($errorFile) {
      try {
        [System.IO.File]::WriteAllText($errorFile, $message, (New-Object System.Text.UTF8Encoding($false)))
      } catch {
      }
    }
  }
}

if ($cancelled) {
  Save-Json $Result ([pscustomobject]@{
    ok = $false
    cancelled = $true
    mode = $Mode
    paths = @($targets)
    error = 'Administrator approval was cancelled.'
  })
  exit 2
}

if ($exitCode -ne 0) {
  $detail = ''
  if ($errorFile -and (Test-Path -LiteralPath $errorFile)) {
    try { $detail = [System.IO.File]::ReadAllText($errorFile) } catch { }
    Remove-Item -LiteralPath $errorFile -Force -ErrorAction SilentlyContinue
  }
  if (-not $detail) { $detail = "Windows PowerShell exited with code $exitCode." }
  Save-Json $Result ([pscustomobject]@{
    ok = $false
    cancelled = $false
    mode = $Mode
    paths = @($targets)
    error = $detail
  })
  exit 1
}

if ($Mode -eq 'add' -and $Stamp) {
  Save-Json $Stamp ([pscustomobject]@{
    appliedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    paths = @($targets)
  })
}

Save-Json $Result ([pscustomobject]@{ ok = $true; cancelled = $false; mode = $Mode; paths = @($targets) })
exit 0
