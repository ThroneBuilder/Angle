<#
PythagoreanTriples.ps1
Created 2025/12/22 by Jeff James <builder@legothrone.com>
#>

$tolerance = 0
$ystep = 1
$xstep = 1

$xlbu = 5
$ylbu = 6
$ah = @{}
$triples = @()
for ($dy = 0; $dy -le 12; $dy += $ystep)
{
    for ($dx = 0.0; $dx -le 14; $dx += $xstep)
    {
        $yl = $dy * $ylbu
        $xl = $dx * $xlbu
        $zl = [math]::Sqrt($xl*$xl + $yl*$yl)
        $liftarm = $zl / $xlbu
        $miss = [math]::Abs($liftarm - [math]::Round($liftarm))
        $angle = [math]::Atan2($yl, $xl) * 180 / [math]::PI
        $sangle = "{0,4:F1}" -f $angle
        if ($miss -le $tolerance -and $liftarm -le (14+$tolerance) -and $angle -gt 0.0 -and !$ah[$sangle])
        {
            $ah[$sangle] = $liftarm
            $triples += New-Object PSObject -Property @{ 
                Angle = $sangle
                dx = "{0,4:F1}" -f  $dx
                dy = "{0,4:F1}" -f  $dy
                Liftarm = "{0,6:F3}" -f $liftarm
                Gap = 0
            }
        }
    }
}
function Writing($f) { Write-Host "Writing $f"; $f }
$triples = $triples | Sort -Descending Angle
$last = 90
$triples | %{ $_.Gap = "{0,4:F1}" -f ($last-$_.Angle); $last = $_.Angle }
$triples | Select Angle,dx,dy,Liftarm,Gap | ft -a
Write-Host "Tolerance=$tolerance YStep=$("{0,3:F1}" -f $ystep) XStep=$xstep Angles=$($triples.Count)"
$triples | Select Angle,dx,dy,Liftarm,Gap | Export-Csv -NoTypeInformation (Writing .\PythagoreanTriples.csv)

<#
Now place these on a curve
[1] All liftarms at outer radius
$rmax = 122
$rliftarms = @(120,120,120,120,120,120,120,120,120,120,120,120,120,120,120)
$rlines = @(103,122)

[2] Each liftarm length at its own radius
$rmax = 84
$rliftarms = @(5,5,5,12,12,22,22,34,34,48,48,64,64,82,82)
$rlines = @(84) #13,23,35,49,64,83)
#>

$rmax = 80
$rliftarms = @(5,5,5,12,12,21,21,32,32,45,45,60,60,77,77)
$rlines = @(79) #13,23,35,49,64,83)

$h = [math]::Floor($rmax * 5 / 6)
$radians = [math]::PI / 180
$matrix = 0..$h | %{ ,@(,'' * (1+$rmax)) }

for ($angle = 0; $angle -le 90; $angle += 0.5)
{
    foreach ($d in $rlines)
    {
        $y = [math]::Round([math]::Sin($angle * $radians) * $d * 5/6)
        $x = [math]::Round([math]::Cos($angle * $radians) * $d)
        $matrix[$h-$y][$x] = 'X'
    }
}

foreach ($t in $triples)
{
    $r = $rliftarms[[math]::Round($t.Liftarm)]
    #
    $angle = 0.0 + $t.Angle
    $oy = [math]::Round([math]::Sin($angle * $radians) * $r * 5/6)
    $ox = [math]::Round([math]::Cos($angle * $radians) * $r)
    $iy = $oy - [math]::Floor($t.dy)
    $ix = $ox - [math]::Floor($t.dx)
    $plates = @('','p','pp')[[math]::Round(3*$t.dy) % 3]
    $offset = [math]::Round(2*$t.dx) % 2
    $cell = $t.Angle # "$($t.Angle)/$($t.dx)/$($t.dy)" -replace ' ',''
    if (!$matrix[$h-$oy][$ox]) { $matrix[$h-$oy][$ox] = $cell } else { $matrix[$h-$oy][$ox] += " $cell" }
    $matrix[$h-$iy][$ix] = $t.Angle
    if ($offset) { $matrix[$h-$iy][$ix-1] = 'o' }
    if ($plates) { $matrix[$h-$iy+1][$ix] = $plates }
    # Write-Host "$($angle): ($ox,$oy) -> ($ix,$iy) $plates$offset"
}
$matrix | %{ $_ -join "`t" } > (Writing .\PythagoreanCurve.csv)