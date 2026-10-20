# Contract: Design Link (URL query string)

Implements FR-024 and FR-025. The link is the only place a design is saved, so this format is a
public contract. Changing it in a breaking way needs a new `v` value and a reader for the old one.

## Format

`https://angle.thronebuilder.com/?v=1&preset=…&top=…&bottom=…&tol=…&place=…&min=…&smin=…&smax=…&emax=…&tess=…&trim=…&a=…`

| Key | Value | Example | Default |
|-----|-------|---------|---------|
| `v` | Format version, integer | `1` | `1` |
| `preset` | Preset id, or `custom` | `hybridOnHybrid` | `brickOnPlate` |
| `top` | `typeId:sizeX[xsizeY][@stepX[xstepY]]` (LBU) | `liftarm:140`, `plate:150x150@10x10` | from the preset |
| `bottom` | `typeId:sizeXxsizeY[@stepXxstepY]` (LBU) | `technicWall:150x132@10x12` | from the preset |
| `tol` | Tolerance filter, LBU per pin, 0 to 1.0, up to 2 decimals | `0.5`, `0` | `0.25` |
| `place` | `c` (centered) or `s` (shifted) | `s` | the preset's (`s` for every preset); `s` for `custom` |
| `min` | Minimum connections, integer | `4` | structural minimum |
| `smin` | Minimum spacing between connected top points, top units | `4` | `2` |
| `smax` | Maximum of the smallest spacing, top units; 0 = no limit | `12` | `0` |
| `emax` | Maximum worst error, LBU; 0 = all | `0.15` | `0` |
| `tess` | Trim tessellated connections: `1` or `0` | `1` | `0` |
| `trim` | `1` or `0` | `1` | `0` |
| `a` | Selected angle, in tenths of a degree | `183` (= 18.3°) | none |

## Rules

- With a named preset, `top` and `bottom` are left out unless they differ from the preset, in
  which case `preset` becomes `custom`. Choosing a preset and then switching to Custom gives the
  same results (FR-003), so either link restores the same design.
- Keys are written in the order shown above, so the same design always produces the same link.
- Steps are written only when they differ from the surface's default; `@` with default steps
  reads the same as no `@`. A step the surface does not offer makes that surface invalid.
- When reading a link, unknown keys are ignored. A missing key takes its default. A value that is
  invalid, out of range, or not a multiple of the step is replaced by the preset default, and its
  key is listed in a notice (FR-025). A bottom surface that is 1D is invalid.
- `a` selects an angle only if that angle qualifies after solving. Otherwise the notice says the
  angle no longer qualifies, and nothing is selected.
- The page updates the link with `replaceState` on every change, and with `pushState` when an
  angle is selected.

## Test cases

| Input | Expected |
|-------|----------|
| `?` (empty) | Brick on plate defaults, no angle selected, no notice |
| `?v=1&preset=plateOnPlate&a=300` | Plate on plate, 30.0° selected if it qualifies |
| `?preset=custom&top=plate:150x150&bottom=plate:150x150` | Same results as `preset=plateOnPlate` |
| `?bottom=liftarm:140` | Bottom replaced by the preset default, notice lists `bottom` |
| `?tol=abc&min=1` | `tol` = 0.25 and `min` = structural minimum, notice lists both |
| `?tol=0` | Accepted: tolerance 0, no notice |
| `?tol=1.5` | `tol` = 0.25, notice lists `tol` (above the 1.0 maximum) |
| Write then read every preset with every option | Gives back the same state |
