<#
DoubleAngles.ps1
Created 2026/10/17 by Jeff James
#>

$xlbu = 10.0; $xstep = 5.0; $xmax = 15.0*$xlbu
$ylbu = 12.0; $ystep = 4.0; $ymax = 7.0*$ylbu
$tolerance = 0.04 * $xlbu
$center = $true

<#
--------------------------------------------------------------------------
GenerateGrid($degrees,$mx,$my,$dx,$dy)
    $rotatedX = $X * :Cos($radians) - $Y * :Sin($radians)
    $rotatedY = $X * :Sin($radians) + $Y * :Cos($radians)
#>
function GenerateGrid($degrees,$tx,$ty,$dx,$dy)
{
    ($mx,$my) = ($tx,$ty)
    ($nx,$ny) = (0,0)
    if ($center)
    {
        $mx = $tx/2; $nx = -$mx
        $my = $ty/2; $ny = -$my
    }
    $text = @()
    $text += "     " + (((0..($tx/$xlbu)) | %{ "{0,2}" -f ($_ % 10) }) -join '')
    $radians = 1.0 * [math]::PI * $degrees / 180.0
    $cos = [math]::Cos($radians)
    $sin = [math]::Sin($radians)
    $points = @()
    for ($y = $ny; $y -le $my; $y += $dy)
    {
        $ly = ($y-$ny) / $ylbu
        $text += ("{0,4:F1} " -f $ly) + (" " * ($tx/$xstep+1))
        for ($x = $nx; $x -le $mx; $x += $dx)
        {
            $lx = ($x-$nx) / $xlbu
            $p = [PSCustomObject]@{X=$x; Y=$y; RX = $x*$cos-$y*$sin; RY = $x*$sin+$y*$cos; LX=$lx; LY=$ly}
            $points += $p
            if ($degrees -gt 0)
            {
                # Write-Host ("l=({0,4:F2},{1,4:F2}) p=({2,4:F2},{3,4:F2}) r=({4,4:F2},{5,4:F2})" -f ($x/$xlbu),($y/$ylbu),$p.X,$p.Y,$p.RX,$p.RY)
            }
        }
    }
    [PSCustomObject]@{Points=$points;Match=@();Text=$text}
}
<#
--------------------------------------------------------------------------
MatchGrids($ga, $gb, $tolerance)
#>
function SetGridMatch($g,$p)
{
    $dx = $p.LX * $xlbu / $xstep
    $dy = $p.LY * $ylbu / $ystep
    $c = $g.Text[1+$dy].ToCharArray()
    $c[5+$dx] = '('
    $c[6+$dx] = ')'
    $g.Text[1+$dy] = $c -join ''
}

function GridText($g)
{
    $g.Text -join "`n"
}

<#
--------------------------------------------------------------------------
MatchGrids($ga, $gb, $tolerance)
#>
function MatchGrids($ga, $gb, $tolerance)
{
    $ga.Match = @()
    $gb.Match = @()
    foreach ($pa in $ga.Points)
    {
        foreach ($pb in $gb.Points)
        {
            $dx = [math]::Abs($pa.RX - $pb.RX)
            $dy = [math]::Abs($pa.RY - $pb.RY)
            if ($dx -lt $tolerance -and $dy -lt $tolerance)
            {
                $dz = [math]::Sqrt($dx*$dx + $dy*$dy)
                if ($dz -le $tolerance)
                {
                    $ga.Match += $pa
                    SetGridMatch $ga $pa
                    $gb.Match += $pb
                    SetGridMatch $gb $pb
                    Write-Host ("la=({0,4:F2},{1,4:F2}) pa=({2,4:F2},{3,4:F2}) | lb=({4,4:F2},{5,4:F2}) pb=({6,4:F2},{7,4:F2}) rb=({8,4:F2},{9,4:F2}) | d=({10,4:F2},{11,4:F2}) z={12,4:F2}" -f $pa.LX,$pa.LY,$pa.X,$pa.Y,$pb.LX,$pb.LY,$pb.X,$pb.Y,$pb.RX,$pb.RY,($dx/$xlbu),($dy/$xlbu),($dz/$xlbu))
                }
            }
        }
    }
    ($ma, $mb)
}

<#
#>


$ga = GenerateGrid 0.0 $xmax $ymax $xstep $ystep
# $aa = 45.0; $da = 0.2
# $aa = 18.2; $da = 0.0
# $aa = 9.1; $da = 0.0
$aa = 10.0; $da = 0.0
for ($a = $aa - $da; $a -le $aa + $da; $a += 0.1)
{
    Write-Host "Angle=$a"
    $gb = GenerateGrid $a $xmax $ymax $xstep $ystep
    ($ma, $mb) = MatchGrids $ga $gb $tolerance
    Write-Host "Angle=$a Matches=$($ma.Count)"
}

Write-Host "GA"
Write-Host (GridText $ga)
Write-Host "GB"
Write-Host (GridText $gb)
