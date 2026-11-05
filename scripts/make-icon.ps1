Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourceCandidates = @(
  (Join-Path $root 'build\new icon.png'),
  (Join-Path $root 'build\icon.png'),
  (Join-Path $root 'resources\icon.png')
)
$source = $sourceCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $source) {
  throw 'No icon source found. Add build\new icon.png first.'
}

$image = [System.Drawing.Image]::FromFile($source)
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'build') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'resources') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'src\renderer\assets') | Out-Null

  function Save-ResizedPng([System.Drawing.Image]$sourceImage, [int]$size, [string]$path) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
    } finally {
      $graphics.Dispose()
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
  }

  Save-ResizedPng $image 1024 (Join-Path $root 'build\icon.png')
  Save-ResizedPng $image 512 (Join-Path $root 'resources\icon.png')
  Save-ResizedPng $image 512 (Join-Path $root 'src\renderer\assets\app-icon.png')

  $sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
  $payloads = @()
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($image, 0, 0, $size, $size)
    } finally {
      $graphics.Dispose()
    }
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $payloads += [pscustomobject]@{ Size = $size; Bytes = $stream.ToArray() }
    $stream.Dispose()
    $bitmap.Dispose()
  }

  $icoPath = Join-Path $root 'build\icon.ico'
  $file = [System.IO.File]::Create($icoPath)
  $writer = New-Object System.IO.BinaryWriter $file
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$payloads.Count)

    $offset = 6 + (16 * $payloads.Count)
    foreach ($payload in $payloads) {
      $dimension = if ($payload.Size -ge 256) { 0 } else { $payload.Size }
      $writer.Write([Byte]$dimension)
      $writer.Write([Byte]$dimension)
      $writer.Write([Byte]0)
      $writer.Write([Byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$payload.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $payload.Bytes.Length
    }
    foreach ($payload in $payloads) {
      $writer.Write($payload.Bytes)
    }
  } finally {
    $writer.Close()
    $file.Dispose()
  }

  Write-Output "Icon source: $source"
  Write-Output "Wrote build\icon.png, resources\icon.png, src\renderer\assets\app-icon.png and build\icon.ico"
} finally {
  $image.Dispose()
}
