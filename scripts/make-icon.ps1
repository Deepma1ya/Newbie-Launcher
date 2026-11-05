Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$size = 1024
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$bg = New-RoundedPath 40 40 944 944 224
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 0, 0),
  (New-Object System.Drawing.Point $size, $size),
  [System.Drawing.Color]::FromArgb(255, 18, 27, 20),
  [System.Drawing.Color]::FromArgb(255, 7, 12, 9)
)
$g.FillPath($bgBrush, $bg)
$border = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 74, 96, 78)), 6
$g.DrawPath($border, $bg)

# subtle block grid
$gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(16, 160, 220, 172)), 2
for ($i = 128; $i -lt 940; $i += 96) {
  $g.DrawLine($gridPen, 96, $i, 928, $i)
  $g.DrawLine($gridPen, $i, 96, $i, 928)
}

# isometric cube
$top = @(
  (New-Object System.Drawing.PointF 512, 190),
  (New-Object System.Drawing.PointF 806, 338),
  (New-Object System.Drawing.PointF 512, 486),
  (New-Object System.Drawing.PointF 218, 338)
)
$left = @(
  (New-Object System.Drawing.PointF 218, 338),
  (New-Object System.Drawing.PointF 512, 486),
  (New-Object System.Drawing.PointF 512, 838),
  (New-Object System.Drawing.PointF 218, 690)
)
$right = @(
  (New-Object System.Drawing.PointF 806, 338),
  (New-Object System.Drawing.PointF 512, 486),
  (New-Object System.Drawing.PointF 512, 838),
  (New-Object System.Drawing.PointF 806, 690)
)

$topBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF 300, 200),
  (New-Object System.Drawing.PointF 750, 470),
  [System.Drawing.Color]::FromArgb(255, 142, 245, 184),
  [System.Drawing.Color]::FromArgb(255, 79, 205, 128)
)
$g.FillPolygon($topBrush, $top)
$leftBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF 218, 400),
  (New-Object System.Drawing.PointF 512, 838),
  [System.Drawing.Color]::FromArgb(255, 58, 139, 88),
  [System.Drawing.Color]::FromArgb(255, 35, 92, 57)
)
$g.FillPolygon($leftBrush, $left)
$rightBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF 512, 400),
  (New-Object System.Drawing.PointF 806, 838),
  [System.Drawing.Color]::FromArgb(255, 44, 113, 70),
  [System.Drawing.Color]::FromArgb(255, 24, 68, 43)
)
$g.FillPolygon($rightBrush, $right)

$outline = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 6, 16, 10)), 7
$g.DrawPolygon($outline, $top)
$g.DrawPolygon($outline, $left)
$g.DrawPolygon($outline, $right)

# dirt speckles on the sides
$speck = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$spots = @(@(300, 470), @(360, 560), @(280, 640), @(430, 720), @(650, 540), @(710, 640), @(580, 750), @(760, 470))
foreach ($s in $spots) {
  $g.FillEllipse($speck, $s[0], $s[1], 14, 14)
}

# little sprout on top
$stem = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 27, 83, 47)), 12
$stem.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$stem.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawBezier($stem, 512, 300, 512, 258, 526, 236, 552, 226)
$leaf1 = New-Object System.Drawing.Drawing2D.GraphicsPath
$leaf1.AddBezier(552, 226, 590, 214, 606, 234, 586, 256)
$leaf1.AddBezier(586, 256, 560, 258, 548, 244, 552, 226)
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 170, 255, 205))), $leaf1)
$leaf2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$leaf2.AddBezier(530, 258, 496, 246, 480, 260, 492, 284)
$leaf2.AddBezier(492, 284, 516, 286, 528, 272, 530, 258)
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 110, 231, 160))), $leaf2)

$g.Dispose()

New-Item -ItemType Directory -Force -Path (Join-Path $root 'build') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $root 'resources') | Out-Null

$pngPath = Join-Path $root 'build\icon.png'
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# resources icon at 512
$small = New-Object System.Drawing.Bitmap 512, 512
$sg = [System.Drawing.Graphics]::FromImage($small)
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sg.DrawImage($bmp, 0, 0, 512, 512)
$sg.Dispose()
$small.Save((Join-Path $root 'resources\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# ICO with a 256x256 PNG payload
$ico256 = New-Object System.Drawing.Bitmap 256, 256
$ig = [System.Drawing.Graphics]::FromImage($ico256)
$ig.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ig.DrawImage($bmp, 0, 0, 256, 256)
$ig.Dispose()
$ms = New-Object System.IO.MemoryStream
$ico256.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()

$fs = [System.IO.File]::Create((Join-Path $root 'build\icon.ico'))
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$pngBytes.Length); $bw.Write([UInt32]22)
$bw.Write($pngBytes)
$bw.Close()

$bmp.Dispose()
$small.Dispose()
$ico256.Dispose()
Write-Output "Icon written to $pngPath"
