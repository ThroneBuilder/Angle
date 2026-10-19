Let's create a static webpage to be hosted at angle.thronebuilder.com to design attaching two LEGO surfaces at specific angles, building on the calculations for brick on plate in FloorAngles.ps1, liftarm against wall in PythagoreanTriples.ps1, and wall on wall in DoubleAngles.ps1.

# Presets

The page starts by defining the top and bottom surfaces with these presets
1. Brick on plate
2. Plate on plate
3. Technic on wall
4. Hybrid wall on hybrid wall
5. Custom

Presets map to settings in custom mode. The surface is defined by potential binding points for steps within in the (0,max) range on X & Y dimensions. The bottom surface must bw a 2D but the top can be 1D or 2D. The surface name dictates these increments and a default size, as well as how the results will be rendered. 

# Surfaces

The following table defines relevant LEGO surfaces in LBU where bricks are 10 LBU wide and 12 high. The binding points start and end 5 LBU from a brick edge and (maybe) 6 LBU from a wall edge, reducing the span to -1 of the surface width or height.

|Surface|Description|X-Step|X-Max|Y-Step|Y-Max|Base Rendering|Fraction Rendering|
|-|-|-|-|-|-|-|-|
|Brick|1x16 Brick|10|150|n/a|n/a|Top-view rectangle with line of brick centered circle studs|n/a|
|Liftarm|1x15 Technic Liftarm|10|140|n/a|n/a|Rectangle with with line of circle holes|n/a|
|Technic|1x16 Technic Brick|5|150|n/a|n/a|Side-view rectangle with edge centered circle holes|1x1 brick with brick centers hole|
|Plate|16x16 Plate|5|150|5|150|Top-view rectangle with brick centered circle studs|Jumper plates across studs|
|Baseplate|32x31 Baseplate|5|310|5|310|Top-view rectangle with brick centered circle studs|Jumper plates across studs|
|Technic Wall|12 stack of 1x16 Technic|5|150|4|132|Side-view stack of rectanglse with edge centered circle holes|1x1 brick with brick centers hole|
|Hybrid Wall|6 layers of 16-wide Plate-Technic-Plate|5|150|4|108|Side-view stack of 4,12,4 LBU rectangles|Fractional height with extra plates above and below 1x2 edge centered or 1x1 brick centered technic piece|

# Angle Solutions

The DoubleAngles.ps1 is the most generic of the three. It calculates the full grid of connection points for both surfaces, then matches the two sets of points the top one rotated by a desired angle around a common centered origin point. Previously, I used a top-left origin but the results are better with centered origin due to error tolerance over high spans. That script converts the LEGO rendering back to top-left origin for rendering. My experience is that pins tolerate 0.5 LBU error, which allows more solutions, though the user should be able to tune this.

When surfaces are defined, if the calculation is fast enough, the script can pre-calculate connection matches for degree angles from 0.1 to 89.9 in 0.1 degree increment, then show a list of found angles, selectable by a list or angles a protractor graphic with hits highlighted. Solutions can be filtered by tolerance, minimum number of matched connections, or reduce that count with a minimum connection gap. 

The wall-on-wall calculations I've done can be simplified as mirror images with holes spaced at half the desired angle and at 90 degrees from that angle but I'm not sure how to choose or simplify these solutions down to that. I also adjust my build size to cover 4-6 of these binding points.

# Solution Rendering

The solution for the chosen angle should have each surface rendered individually to look like the chosen LEGO surface from the top or side with the necessary parts for fractional spacing. The angled layering should be rendered in 3D allowing rotation.

The user can download these images directly from the browser or click to download an LDraw file containing with the build or a CSV containing a parts list.

