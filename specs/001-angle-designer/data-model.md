# Data Model: Angle Designer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-19

All lengths are in LBU: the stud-to-stud distance (a brick's width) is 10 LBU, a brick's height
is 12 LBU, and a plate's height is 4 LBU. Angles are integer
tenths of a degree (`AngleTenths`, 1–899). Every type is plain, serializable data, so the same
objects can be passed to and from the worker, compared in tests, and written to the link.

## SurfaceType

Static data. One record per row of the spec's Surfaces table, defined in `src/surfaces/surface-types.ts`.

| Field | Type | Notes / validation |
|-------|------|--------------------|
| `id` | `'brick' \| 'liftarm' \| 'technic' \| 'plate' \| 'baseplate' \| 'technicWall' \| 'hybridWall'` | Unique |
| `name` | string | For example, "1x16 Brick" |
| `dimensions` | `1 \| 2` | Only 2D types may be the bottom surface (FR-004) |
| `stepX`, `stepY` | number (LBU) | `stepY` is absent when `dimensions = 1` |
| `maxX`, `maxY` | number (LBU) | A multiple of the step. The default size is the maximum |
| `receiveStepX`, `receiveStepY` | number (LBU) | Step used when this type is the *top* surface. Defaults to `stepX`/`stepY` (see research R6) |
| `edgeOffset` | number (LBU) | 5 for brick-based types, 6 for walls (spec assumption) |
| `view` | `'top' \| 'side'` | Drawing view (FR-016) |
| `drawing` | `DrawingStyle` | Base drawing: studs, holes, layer heights |
| `connectorKind` | `'stud' \| 'hole'` | Used to choose the connector (FR-020a) |
| `fractionRules` | `FractionRule[]` | Parts that create positions between whole steps (FR-017, research R9) |
| `baseParts` | `PartRef[]` (via layout function id) | Parts that make up the full surface |

## Preset

| Field | Type | Notes |
|-------|------|-------|
| `id` | `'brickOnPlate' \| 'plateOnPlate' \| 'technicOnWall' \| 'hybridOnHybrid'` | |
| `config` | `Configuration` | A preset is just a named configuration (FR-003) |
| `filters` | `FilterSettings` | The preset's default filters (tolerance 0.5, structural minimum, gap 0) |

| Preset | Top | Bottom |
|--------|-----|--------|
| Brick on plate | brick | plate |
| Plate on plate | plate | plate |
| Technic on wall | liftarm | technicWall |
| Hybrid wall on hybrid wall | hybridWall | hybridWall |

## Configuration

What the solver needs. Changing any of these re-runs the solver.

| Field | Type | Validation |
|-------|------|------------|
| `top` | `SurfaceSpec` | Any surface type |
| `bottom` | `SurfaceSpec` | `type.dimensions = 2` |
| `placement` | `'centered' \| 'shifted'` | Default `'centered'` |

The solver always matches at the fixed `SOLVE_TOLERANCE_LBU = 1.0` (research R15). Tolerance is
not part of the Configuration.

**SurfaceSpec**: `{ typeId, sizeX, sizeY? }`. Each size is a positive multiple of the type's step
and no larger than the type's maximum. `sizeY` is required only for 2D types.

## FilterSettings

Applied to stored results without re-running the solver (FR-011).

| Field | Type | Validation |
|-------|------|------------|
| `toleranceLbu` | number | 0 ≤ value ≤ 1.0 (`SOLVE_TOLERANCE_LBU`); default 0.5. 0 is allowed |
| `minConnections` | integer | At least the structural minimum: 2 for a 1D top, 3 for a 2D top (FR-011a) |
| `minGapLbu` | number | ≥ 0; default 0 (off) |

## BindingPoint

| Field | Type | Notes |
|-------|------|-------|
| `i`, `j` | integer | Grid index along X and Y. This is the point's identity, and it is exact |
| `x`, `y` | number | Position in LBU relative to the surface center: `i·step − size/2` |

## Placement

| Field | Type | Notes |
|-------|------|-------|
| `offsetX`, `offsetY` | number (LBU) | Offset of the rotated top surface from centered. `(0, 0)` in centered mode |

## Connection

| Field | Type | Notes |
|-------|------|-------|
| `top` | `{ i, j }` | Top binding point |
| `bottom` | `{ i, j }` | Bottom binding point |
| `errorLbu` | number | Distance after rotation and offset, ≤ `SOLVE_TOLERANCE_LBU`. Shown only if ≤ the filter tolerance (FR-008, FR-009) |

## AngleSolution

One per angle that has at least one connection. Produced by the solver.

| Field | Type | Notes |
|-------|------|-------|
| `angle` | `AngleTenths` | Unique within a result set |
| `placement` | `Placement` | |
| `connections` | `Connection[]` | Sorted by bottom `(j, i)`; this order is part of the contract |
| `worstErrorLbu` | number | Largest `errorLbu` |

**Derived (computed by the filter, never stored)**: `kept` (connections left after the tolerance
filter and then the gap filter), `qualifies` (FR-011a), `connectionCount = kept.length`, and
`shownWorstErrorLbu` (largest error among `kept`).

## SolveResult

| Field | Type | Notes |
|-------|------|-------|
| `config` | `Configuration` | Exactly the input it was solved for |
| `solutions` | `AngleSolution[]` | In angle order |
| `complete` | boolean | `false` if cancelled, or if the page fell back to a single angle |

**Transfer format**: Between the worker and the page, a SolveResult is sent as packed typed
arrays: per-angle offsets into one `Int16Array` of `(topI, topJ, bottomI, bottomJ)` and one
`Float32Array` of errors (transferred, not copied). `src/solver/packing.ts` converts it to and from
the shape above, and that conversion is tested both ways. Errors are rounded to `Float32`
*inside* the solver, before the solver returns, so Node tests and the page see identical values.

**States**: `idle → solving(progress 0–1) → complete`. Also `solving → cancelled`, when a setting
changes and a new solve starts, and `solving → overBudget`, when the page offers a single angle
instead.

## BuildOptions

| Field | Type | Notes |
|-------|------|-------|
| `trimToConnections` | boolean | Default `false` (FR-020b) |

## Connector

| Field | Type | Notes |
|-------|------|-------|
| `at` | `Connection` | |
| `part` | `PartRef` | Pin for hole to hole. Round plate, 1 × 2 jumper, or 2 × 2 jumper for studs (research R8) |
| `rotation` | number (degrees) | For jumper plates that must line up with the half step |

## Build

The single model behind the drawings, the 3D view, LDraw, and the CSV (FR-021, Constitution V).

| Field | Type | Notes |
|-------|------|-------|
| `config`, `filters`, `options` | | Copied in, so the build states its settings (FR-023) |
| `angle` | `AngleTenths` | |
| `placement` | `Placement` | |
| `connections` | `Connection[]` | The kept connections only (after the tolerance and gap filters) |
| `bottomParts`, `topParts` | `PlacedPart[]` | Surface plus offset parts, in that surface's own coordinates |
| `connectors` | `Connector[]` | |
| `catalogVersion` | string | |
| `warnings` | string[] | For example, overlapping risers, or a part that is not current |

**PlacedPart**: `{ part: PartRef, x, y, z, rotationDeg, color: ColorRef }`, in LBU. The top
surface's parts are converted to world coordinates with the angle and offset only when rendering
or exporting.

## Catalog

| Field | Type | Notes |
|-------|------|-------|
| `version` | string | For example, `lego-angle-2026-10-19` |
| `snapshotDate` | ISO date | |
| `source` | `{ provider, url, sha256 }` | Rebrickable files, as in Mountain |
| `parts` | `Record<partNo, { name, ldrawFile, colors: colorId[] }>` | Currently produced parts and colors only |
| `colors` | `Record<colorId, { name, ldrawCode, rgb }>` | |

`PartRef` is the part number. `ColorRef` is a catalog color id. Default colors: bottom light
bluish gray, top dark bluish gray, connectors black, offset parts tan. A default is replaced
automatically if the catalog does not list that color as current for the part.

## Relationships

```text
Preset ──is a named── Configuration ──(solve)──> SolveResult ──has many── AngleSolution
                                                                              │
                         FilterSettings ──(filter)──> kept Connections <──────┘
                                                            │
       AngleSolution + kept Connections + BuildOptions + Catalog ──(build)──> Build
                                                            │
                     ┌─────────────┬─────────────┬──────────┴───┬────────────┐
                 2D drawings     3D view      LDraw file     CSV file    link (state only)
```
