# Contract: Downloads (LDraw, CSV, images)

Implements FR-019 to FR-023. Every download is generated from one `Build`
([data-model.md](../data-model.md#build)), so the files always agree with each other.

## File names

`angle-{preset|custom}-{angle as 18p3}deg.{ldr|csv|png}`. For example,
`angle-hybridOnHybrid-18p3deg.ldr`. Drawings add `-top` or `-bottom`, and the 3D view adds `-3d`.

## LDraw (`.ldr`)

- Plain LDraw text with CRLF line endings, in UTF-8.
- The header is LDraw metadata lines (`0 …`) followed by comments that record the settings:

  ```text
  0 Angle Designer build: Hybrid wall on hybrid wall at 18.3°
  0 Name: angle-hybridOnHybrid-18p3deg.ldr
  0 Author: angle.thronebuilder.com
  0 // top=hybridWall:150x108 bottom=hybridWall:150x108 tol=0.5 place=c min=3 smin=2 smax=0 trim=0
  0 // offset=(0.0000,0.0000) LBU connections=6 worstError=0.312 LBU catalog=lego-angle-2026-10-19
  ```

- `0 STEP` separates three steps: bottom surface with its offset parts, then connectors, then top
  surface with its offset parts.
- Parts are type-1 lines: `1 <color> x y z a b c d e f g h i <part>.dat`.
  - Coordinates are in LDU = LBU × 2 (`units.ts`), with Y pointing down (height goes negative).
  - Matrix values are written to 6 decimal places, and positions to 4 decimal places.
  - `<color>` is the catalog's LDraw color code.
- Every part line refers to a part and color the build's catalog lists as current (FR-022).

**Checks**: a structural parser test confirms every line is a valid LDraw line type 0 or 1, every
matrix has 9 values, and every referenced part is in the catalog. Opening the file in an LDraw
viewer is a manual check at each checkpoint (SC-005).

## CSV parts list

- UTF-8, comma separated, CRLF line endings, with a header row:

  ```csv
  Part,Name,Color,LDraw Color,Quantity
  3703,"Technic, Brick 1 x 16 with Holes",Light Bluish Gray,71,24
  2780,"Technic Pin with Friction Ridges",Black,0,6
  ```

- One row per part and color pair. Rows are sorted by part number, then color name.
- **Invariant (tested)**: for every part and color, `Quantity` equals the number of type-1 lines
  with that part and color in the `.ldr` for the same build (FR-020, SC-005).

## Images

- The surface drawings are SVG, turned into a PNG at 2× scale through an off-screen canvas. They
  can also be downloaded as SVG.
- The 3D view is a PNG of the current camera view (`preserveDrawingBuffer`).
- Images are for viewing only, so they are not covered by the determinism requirement.
