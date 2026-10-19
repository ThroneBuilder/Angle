<#
export-fixtures.ps1
Writes the frozen golden fixtures in tests/fixtures/ from the reference scripts' formulas.
These fixtures are FROZEN: regenerate only on purpose, and say why in the commit (Constitution VI).

(a) double-angles.json  DoubleAngles.ps1: X step 5 max 150, Y step 4 max 84, centered, tolerance 0.4 LBU.
    Same rotation and match test as the script (|dx| < tol and |dy| < tol and distance <= tol).
    With tol < half the smallest step, only the nearest bottom point can match, so each rotated top
    point is compared with its nearest bottom point instead of every pair (same result, much faster).
(b) pythagorean.json    PythagoreanTriples.ps1 table (tolerance 0).
(c) floor-angles.json   FloorAngles.ps1 table (tolerance 0.07).
For (b) and (c), the scripts count whole steps: one dx step is the stud-to-stud distance (10 LBU);
one dy step is a brick height (12 LBU) in PythagoreanTriples or 10 LBU in FloorAngles. $xlbu = 5 and
$ylbu = 6 are only the 10:12 ratio halved. Liftarm length L is L x 10 LBU.
#>

$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot '..\tests\fixtures'
New-Item -ItemType Directory -Force $out | Out-Null
$frozen = 'FROZEN golden fixture from reference/export-fixtures.ps1. Regenerate only on purpose (Constitution VI).'

# (a) DoubleAngles ------------------------------------------------------------------------------
$xstep = 5.0; $xmax = 150.0; $ystep = 4.0; $ymax = 84.0; $tol = 0.4
$mx = $xmax / 2; $my = $ymax / 2
$nxPts = [int]($xmax / $xstep) + 1; $nyPts = [int]($ymax / $ystep) + 1
$angles = [System.Collections.Generic.List[object]]::new()
for ($k = 1; $k -le 899; $k++)
{
    $radians = [math]::PI * ($k / 10.0) / 180.0
    $cos = [math]::Cos($radians); $sin = [math]::Sin($radians)
    $pairs = [System.Collections.Generic.List[object]]::new()
    for ($j = 0; $j -lt $nyPts; $j++)
    {
        $y = $j * $ystep - $my
        for ($i = 0; $i -lt $nxPts; $i++)
        {
            $x = $i * $xstep - $mx
            $rx = $x * $cos - $y * $sin
            $ry = $x * $sin + $y * $cos
            $bi = [int][math]::Round(($rx + $mx) / $xstep)
            $bj = [int][math]::Round(($ry + $my) / $ystep)
            if ($bi -lt 0 -or $bi -ge $nxPts -or $bj -lt 0 -or $bj -ge $nyPts) { continue }
            $dx = [math]::Abs(($bi * $xstep - $mx) - $rx)
            $dy = [math]::Abs(($bj * $ystep - $my) - $ry)
            if ($dx -lt $tol -and $dy -lt $tol -and [math]::Sqrt($dx*$dx + $dy*$dy) -le $tol)
            {
                $pairs.Add(@($i, $j, $bi, $bj))
            }
        }
    }
    if ($pairs.Count -gt 0) { $angles.Add([ordered]@{ k = $k; pairs = $pairs.ToArray() }) }
}
[ordered]@{
    _comment = $frozen
    source = 'DoubleAngles.ps1'
    grid = [ordered]@{ stepX = $xstep; sizeX = $xmax; stepY = $ystep; sizeY = $ymax }
    toleranceLbu = $tol
    pairFormat = '[topI, topJ, bottomI, bottomJ]'
    angles = $angles.ToArray()
} | ConvertTo-Json -Depth 6 -Compress | Set-Content -Encoding utf8 (Join-Path $out 'double-angles.json')
Write-Host "double-angles.json: $($angles.Count) angles"

# (b), (c) Liftarm tables -----------------------------------------------------------------------
function TripleTable($xlbu, $ylbu, $dxMax, $dyMax, $tolerance, $dyLbuPerStep)
{
    $seen = @{}
    $rows = [System.Collections.Generic.List[object]]::new()
    for ($dy = 0; $dy -le $dyMax; $dy++)
    {
        for ($dx = 0; $dx -le $dxMax; $dx++)
        {
            $yl = $dy * $ylbu; $xl = $dx * $xlbu
            $liftarm = [math]::Sqrt($xl*$xl + $yl*$yl) / $xlbu
            $miss = [math]::Abs($liftarm - [math]::Round($liftarm))
            $angle = [math]::Atan2($yl, $xl) * 180 / [math]::PI
            $sangle = '{0:F1}' -f $angle
            if ($miss -le $tolerance -and $liftarm -le (14 + $tolerance) -and $angle -gt 0.0 -and -not $seen[$sangle])
            {
                $seen[$sangle] = $true
                $rows.Add([ordered]@{
                    angle = [double]$sangle
                    dx = $dx; dy = $dy
                    liftarm = [math]::Round($liftarm, 3)
                    dxLbu = $dx * 10
                    dyLbu = $dy * $dyLbuPerStep
                    lengthLbu = [math]::Round($liftarm) * 10
                })
            }
        }
    }
    $rows.ToArray()
}

$py = TripleTable 5 6 14 12 0 12
[ordered]@{
    _comment = $frozen
    source = 'PythagoreanTriples.ps1'
    bottomStepLbu = [ordered]@{ x = 10; y = 12 }
    tolerance = 0
    rows = $py
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $out 'pythagorean.json')
Write-Host "pythagorean.json: $($py.Count) rows"

$fl = TripleTable 5 5 16 16 0.07 10
[ordered]@{
    _comment = $frozen
    source = 'FloorAngles.ps1'
    bottomStepLbu = [ordered]@{ x = 10; y = 10 }
    tolerance = 0.07
    rows = $fl
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $out 'floor-angles.json')
Write-Host "floor-angles.json: $($fl.Count) rows"
