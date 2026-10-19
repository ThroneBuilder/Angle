# Tasks: Angle Designer

**Input**: Design documents from `specs/001-angle-designer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principle VI requires automated tests for every deterministic
stage (grid, rotation, matching, filtering, unit conversion, LDraw and CSV output), plus golden
fixtures from the reference scripts. Write each test first and confirm it fails before
implementing.

**Organization**: Tasks are grouped by user story, so each story can be built, tested, and shown
on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US5)
- All paths are relative to the repository root (a single project; see plan.md)

## Shared conventions (apply to every task)

- Lengths are in LBU: the stud-to-stud distance (a brick's width) is 10, a brick's height is 12,
  and a plate's height is 4. Angles are integer tenths of a degree (`AngleTenths`, 1–899).
  Convert to LDU or pixels **only** in `src/geometry/units.ts`.
- The solver MUST NOT call `Math.sin` or `Math.cos`. It uses `src/geometry/trig-table.ts`. Matches
  compare squared distance with `SOLVE_TOLERANCE_LBU²`, where `SOLVE_TOLERANCE_LBU = 1.0`
  (research R2, R15).
- Tolerance is a **filter**, not a solver input. The solver stores every connection within 1.0 LBU
  with its error. The page hides connections above the chosen tolerance (0–1.0, default 0.5).
  Changing any filter never re-runs the solver (FR-008, FR-011, Constitution IV).
- A binding point's position relative to its surface's center is `x = i·stepX − sizeX/2`,
  `y = j·stepY − sizeY/2` (data-model `BindingPoint`). For a 1D surface, `y = 0` and `j = 0`.
- A rotated top point is `(x·cos − y·sin + offsetX, x·sin + y·cos + offsetY)`.
- TypeScript `strict: true`. No `any` without an inline comment explaining why.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the project and its tooling.

- [ ] T001 Move `FloorAngles.ps1`, `PythagoreanTriples.ps1`, and `DoubleAngles.ps1` from the
  repository root into `reference/`, and add `reference/README.md` explaining that they are
  checking references only: never imported, bundled, or deployed.
- [ ] T002 Create `package.json` (pnpm, `"type": "module"`, `"engines": { "node": ">=24" }`) with
  scripts `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `preview` (`vite preview`),
  `test` (`vitest run`), `test:watch` (`vitest`), `gen:trig` (`node --experimental-strip-types
  scripts/gen-trig-table.ts`), and `catalog` (`node --experimental-strip-types
  scripts/build-catalog.ts`). Install the dev dependencies `typescript`, `vite`, and `vitest`.
  Add `.node-version` containing `24`.
- [ ] T003 [P] Create `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`,
  `module: "ESNext"`, `moduleResolution: "bundler"`, `target: "ES2022"`,
  `lib: ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]`, `include: ["src", "tests", "scripts"]`.
- [ ] T004 [P] Create `vite.config.ts` (default single-page config, `worker: { format: 'es' }`) and
  `vitest.config.ts` (`environment: 'node'`, `include: ['tests/**/*.test.ts']`).
- [ ] T005 [P] Create `index.html` with semantic regions: `<header>`; `<section id="controls">`;
  `<section id="results">` holding `#angle-list` and `#protractor`; `<section id="drawings">`;
  `<section id="view3d">`; `<section id="downloads">`; `<div id="notices" role="status">`. Load
  `src/main.ts`. Create `src/styles.css` with color tokens on `:root`, a dark scheme under
  `prefers-color-scheme`, and a single-column layout below 720 px.
- [ ] T006 [P] Create `render.yaml` for a Render static site: `buildCommand: pnpm install && pnpm
  build`, `staticPublishPath: dist`, `NODE_VERSION=24`, and the cache headers Faceplate uses
  (`/*` must-revalidate, `/assets/*` immutable for one year).
- [ ] T007 [P] Create `.gitignore` covering `node_modules/`, `dist/`, `coverage/`, and `.vite/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, deterministic math, and surface data that every story uses.

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

- [ ] T008 Create `src/types.ts` with every type from data-model.md: `AngleTenths`,
  `SurfaceTypeId`, `SurfaceType`, `SurfaceSpec`, `Configuration`, `FilterSettings`,
  `BindingPoint`, `Placement`, `Connection`, `AngleSolution`, `SolveResult`, `BuildOptions`,
  `Connector`, `PlacedPart`, `Build`, `Catalog`, `PartRef`, `ColorRef`. Every type is plain data
  (no classes, no functions), so it can be passed to and from the worker.
- [ ] T009 [P] Write `scripts/gen-trig-table.ts`. It generates `src/geometry/trig-table.ts`,
  exporting `COS: readonly number[]` and `SIN: readonly number[]` of length 901 (index `k` = `k`
  tenths of a degree), with each value written via `Number.prototype.toString()` (which gives back
  the exact double). Force exact values at `k = 0` (cos 1, sin 0) and `k = 900` (cos 0, sin 1).
  Run it and commit the output.
- [ ] T010 [P] Write `tests/unit/trig-table.test.ts`: length 901; exact endpoint values;
  `|COS[k] − Math.cos(k·π/1800)| < 1e-15` for every k; `COS[k] === SIN[900 − k]` for every k.
- [ ] T011 [P] Write `tests/unit/units.test.ts`, then `src/geometry/units.ts`, exporting
  `lbuToLdu(v) = v * 2`, `ldrawY(heightLbu) = -heightLbu * 2`, `tenthsToDegrees(k) = k / 10`,
  and `formatAngle(k)` (`183 → "18.3°"`, `5 → "0.5°"`). Tests cover exact integer results for
  0, 5, 10, 12, 150, and 310 LBU.
- [ ] T012 [P] Create `src/surfaces/surface-types.ts`, exporting `SURFACE_TYPES: Record<SurfaceTypeId,
  SurfaceType>` with exactly these values (spec Surfaces table; research R8 and R9):
  brick `{dimensions 1, stepX 10, maxX 150, view 'top', connectorKind 'stud', edgeOffset 5}`;
  liftarm `{1, stepX 10, maxX 140, 'side', 'hole', 5}`;
  technic `{1, stepX 5, maxX 150, 'side', 'hole', 5}`;
  plate `{2, 5, 150, stepY 5, maxY 150, 'top', 'stud', 5}`;
  baseplate `{2, 5, 310, 5, 310, 'top', 'stud', 5}` (32 × 32; see research R8);
  technicWall `{2, 5, 150, 4, 132, 'side', 'hole', 6}`;
  hybridWall `{2, 5, 150, 4, 108, 'side', 'hole', 6}`.
  `receiveStepX`/`receiveStepY` default to `stepX`/`stepY` (research R6, open question). Leave
  `fractionRules`, `baseParts`, and `drawing` as typed empty placeholders, to be filled in US3.
- [ ] T013 [P] Create `src/surfaces/presets.ts`, exporting `PRESETS` for `brickOnPlate`
  (brick:150 on plate:150x150), `plateOnPlate` (plate:150x150 on plate:150x150),
  `technicOnWall` (liftarm:140 on technicWall:150x132), and `hybridOnHybrid`
  (hybridWall:150x108 on hybridWall:150x108). All use `placement: 'centered'`, and default
  filters `{ toleranceLbu: 0.5, minConnections: structuralMinimum(top), minGapLbu: 0 }`. Also
  export `SOLVE_TOLERANCE_LBU = 1.0` from `src/solver/constants.ts`.
- [ ] T014 Write `tests/unit/validate.test.ts`, then `src/surfaces/validate.ts`, exporting
  `validateConfiguration(c): string[]`, which returns readable errors for: a size that is not a
  positive multiple of its step; a size larger than the type's maximum; a missing `sizeY` on a 2D
  type; a bottom type whose `dimensions` is not 2 (FR-004). Also export
  `validateFilters(f, top): string[]`, which rejects a tolerance outside "0 ≤ value ≤ 1.0" (0 is
  valid) and a negative gap. Also export `structuralMinimum(top) = top.dimensions === 1 ? 2 : 3`
  (FR-011a).
- [ ] T015 Write `tests/unit/grid.test.ts`, then `src/solver/grid.ts`, exporting
  `bindingPoints(spec, role: 'top' | 'bottom'): BindingPoint[]`. The top uses
  `receiveStep*`, and the bottom uses `step*`. Points are ordered by `j`, then `i`, with positions
  from the shared conventions. Tests: plate:150x150 gives 961 points with corners at
  (±75, ±75); liftarm:140 gives 15 points from −70 to 70; hybridWall:150x108 gives 31 × 28
  points.

**Checkpoint**: `pnpm test` passes. The types, trig table, units, surface data, and grids are
ready.

---

## Phase 3: User Story 1 - Find the angles two surfaces can make (Priority: P1) 🎯 MVP

**Goal**: Pick a preset or Custom, and see every qualifying angle from 0.1° to 89.9° with its
connection count and worst error. Filter by tolerance, minimum connections, and gap. Optional
shifted placement. The design is kept in the link.

**Independent Test**: Load each preset and compare against the golden fixtures from the
reference scripts. In the browser, run quickstart.md checks US1 1–6 and Link 1–2.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [ ] T016 [US1] Write `reference/export-fixtures.ps1`, which dot-sources nothing from the
  product. It reuses the reference scripts' formulas and writes JSON into `tests/fixtures/`:
  (a) `double-angles.json`: for DoubleAngles.ps1's grid (X step 5, max 150; Y step 4, max 84;
  centered; tolerance 0.4 LBU), list every 0.1° angle from 0.1 to 89.9 with its matched point
  pairs as grid indices `{top:{i,j}, bottom:{i,j}}`. (b) `pythagorean.json`: the
  PythagoreanTriples.ps1 table (Angle, dx, dy, Liftarm) with tolerance 0. (c)
  `floor-angles.json`: the FloorAngles.ps1 table with tolerance 0.07. For (b) and (c), convert
  to LBU before writing (research R14, "Reference script units"). One `dx` step is the
  stud-to-stud distance, 10 LBU. One `dy` step is a brick height, 12 LBU, in PythagoreanTriples,
  and the stud-to-stud distance, 10 LBU, in FloorAngles. A liftarm length `L` is `L × 10` LBU.
  The scripts' `$xlbu = 5` / `$ylbu = 6` are only that ratio halved. Write `dxLbu`, `dyLbu`, and
  `lengthLbu` alongside the original columns. Run it once and commit the three JSON files. Record
  in the file header that the fixtures are frozen and may only be regenerated on purpose
  (Constitution VI).
- [ ] T017 [P] [US1] Write `tests/fixtures/golden.test.ts`.
  (a) Centered solving of hybridWall:150x84 on hybridWall:150x84, then the tolerance filter at
  0.4, MUST give exactly the connection pairs in `double-angles.json` for every angle. The script uses strict
  `<` on each axis and then `≤` on distance; compare with the solver's `≤` and list any
  boundary-only differences in a `KNOWN_DIFFERENCES` array, each with a justification comment.
  (b) For every row of `pythagorean.json` and `floor-angles.json`, build an ad-hoc 1D top with
  step 10 LBU and length `lengthLbu`, and an ad-hoc 2D bottom with steps 10 × 12 LBU
  (PythagoreanTriples) or 10 × 10 LBU (FloorAngles). Shifted solving, then the tolerance filter
  at 0.5, MUST find at least 2 connections at the row's angle rounded to 0.1°.
- [ ] T018 [P] [US1] Write `tests/unit/centered.test.ts`: at angle 0 (call
  `solveAngleCentered(config, 0)` directly for the test), a plate on an identical plate matches
  every point with error 0. At 90.0° (k = 900, via the same direct call), a square plate matches
  every point. A liftarm on a plate at 36.9° has connections. All errors are ≤ tolerance, and
  connections are sorted by bottom `(j, i)`.
- [ ] T019 [P] [US1] Write `tests/unit/circle.test.ts` for the smallest enclosing circle:
  1 point (radius 0), 2 points (diameter), 3 points on a circle, points inside the hull. The
  result is the same whatever order the input arrives in.
- [ ] T020 [P] [US1] Write `tests/unit/shifted.test.ts`. Build a configuration where the best
  placement is an offset of (+2, −1) LBU, and confirm the shifted solve finds it within 0.05 LBU
  with more connections than centered. Shifted never returns fewer connections than centered for
  the same angle. The tie-break order follows research R4 step 4. Every stored error is ≤
  `SOLVE_TOLERANCE_LBU`.
- [ ] T021 [P] [US1] Write `tests/unit/filter.test.ts`. The tolerance filter runs first and drops
  connections with `errorLbu` above the tolerance. At tolerance 0, only connections with error
  exactly 0 remain. At 1.0, nothing is dropped. Changing tolerance never calls the solver (use
  a spy). The gap filter keeps connections in bottom `(j, i)` order, dropping any closer than
  `gap` to one already kept. Collinear connections on a
  2D top do not qualify, whatever their number. A 1D top qualifies with 2 connections. A 2D top
  qualifies with 3 non-collinear connections. `minConnections` is raised to the structural
  minimum if set lower.
- [ ] T022 [P] [US1] Write `tests/contract/solver-determinism.test.ts`. `solveRange(config, 1,
  899)` on every preset, in both placement modes, run twice, gives deep-equal results. Solutions
  are in angle order with unique angles. No solution has an empty `connections` array. Packing
  then unpacking (`src/solver/packing.ts`) gives back a deep-equal result.
- [ ] T023 [P] [US1] Write `tests/contract/url-state.test.ts`, covering every row of the "Test
  cases" table in `specs/001-angle-designer/contracts/url-state.md`, plus: write then read for each
  preset × placement × an angle gives back the same state, and the key order is stable.

### Implementation for User Story 1

- [ ] T024 [US1] Implement `src/geometry/circle.ts`: `minEnclosingCircle(points)` using Welzl's
  algorithm, iterative. Sort the input by (x, y) before running, so the result never depends on
  input order. Makes T019 pass.
- [ ] T025 [US1] Implement `src/solver/centered.ts`: `solveAngleCentered(config, k):
  AngleSolution | null` (research R3). Rotate each top point with `COS[k]`/`SIN[k]`. Find the
  nearest bottom index by `round((X + sizeX/2) / stepX)`, and the same for Y. Skip it if out of
  range, and keep it if `dx² + dy² ≤ SOLVE_TOLERANCE_LBU²`. Store
  `errorLbu = Math.fround(Math.sqrt(dx² + dy²))` (rounded to Float32 so packing is exact). Sort
  connections by bottom `(j, i)`. Return `null` if there are none.
- [ ] T026 [US1] Implement `src/solver/shifted.ts`: `solveAngleShifted(config, k)`, following
  research R4 steps 1–5 exactly. Use grid resolution `h = SOLVE_TOLERANCE_LBU / 5` (0.2 LBU),
  store errors with `Math.fround` as in T025, and scan coverage
  cells in row order from the cell nearest (0, 0). Refine with `minEnclosingCircle`. Try every
  whole-step placement within half the bottom size. Choose by: most connections, then smallest
  worst error, then nearest to centered, then smaller |offsetX|, then smaller |offsetY|, then
  positive before negative. Return the centered result unless the shifted one has more
  connections, or the same number with a smaller worst error. Makes T020 pass.
- [ ] T027 [US1] Implement `src/solver/solve.ts`: synchronous `solveRange(config, fromK, toK):
  AngleSolution[]`, which loops over the range using the placement mode's function, and
  `solveAngle(config, k)` for a single angle. No progress or cancel logic here; the worker
  handles that in chunks (T029). Implement `src/solver/packing.ts` (`pack(result)` and
  `unpack(packed)`, as in the data-model's "Transfer format"). Makes T017, T018, and T022 pass.
- [ ] T028 [US1] Implement `src/solver/filter.ts`: `applyFilters(solution, filters, top):
  { kept: Connection[]; qualifies: boolean; shownWorstErrorLbu: number }` and
  `qualifyingAngles(result, filters)`, as in research R5, in the order tolerance, gap,
  qualify. The collinearity test uses exact integer cross products on bottom `(i, j)`. Makes
  T021 pass.
- [ ] T029 [US1] Implement `src/solver/worker.ts` and `src/solver/client.ts` according to
  `specs/001-angle-designer/contracts/solver-worker.md`. `solveAll` calls `solveRange` in chunks
  of 10 angles. After each chunk it posts `progress`, then pauses with
  `await new Promise(r => setTimeout(r, 0))`, so a waiting `cancel` is handled before the next
  chunk. On `cancel` it stops and posts `cancelled`. Use `gen` to ignore old results. After the
  first chunk, estimate the total time; if it is over `budgetMs` (10,000), send `overBudget` with
  the partial result. Results are sent packed, with their buffers in the transfer list. The
  client exposes `start(config)`, `startSingle(config, k)`, and `onUpdate(cb)`, unpacks results,
  and terminates and recreates the worker only if `cancelled` does not arrive within 200 ms.
- [ ] T030 [US1] Implement `src/state/url-state.ts`: `readState(search): { state; replaced: string[] }`
  and `writeState(state): string`, as in `contracts/url-state.md` (keys `v, preset, top, bottom,
  tol, place, min, gap, trim, a`, in that order). Use `replaceState` on changes and `pushState`
  when an angle is selected. Makes T023 pass.
- [ ] T031 [US1] Implement `src/ui/controls.ts`: a preset selector (4 presets plus Custom); a top
  and bottom type picker with size inputs limited to the type's step and maximum (only 2D types in
  the bottom picker); centered/shifted toggle; and, grouped as filters, tolerance (0–1.0, step
  0.05, 0 allowed); minimum connections
  (no lower than `structuralMinimum`); gap (≥ 0). Every control has a `<label>`. Choosing Custom
  copies the current preset's values (FR-003). Show the errors from `validateConfiguration` inline,
  and do not start a solve while there are errors.
- [ ] T032 [US1] Implement `src/ui/angle-list.ts`: a list of qualifying angles in angle order
  (FR-011b), showing angle, connection count after the tolerance and gap filters, worst shown
  error (3 decimals), and the offset when shifted. Selection uses `role="listbox"` with arrow keys,
  Home/End, and Enter (FR-015). Above the list, show a one-line settings summary (FR-023):
  surfaces and sizes, placement mode, tolerance, minimum connections, gap, and, once the catalog
  exists (US3), its version. For example: "Liftarm 140 on Technic Wall 150×132 · centered ·
  tol 0.5 · min 2 · gap 0". Also show the qualifying count (research R6), the solve progress, a
  Cancel button, and an empty-state message suggesting looser filters. When the tolerance is 0,
  the message explains that exact matches are rare at 0.1° steps (spec edge case).
- [ ] T033 [US1] Implement `src/ui/notices.ts` for link replacement notices (FR-025), the
  over-budget offer with a single-angle input (0.1–89.9, 0.1 steps) that calls `startSingle`, and
  "selected angle no longer qualifies".
- [ ] T034 [US1] Wire it all together in `src/main.ts`: read the link state, then controls; config
  changes start the client; results and filters update the angle list; a selection updates the
  link. Filter changes, including tolerance, re-filter the stored `SolveResult` and redraw the
  list, protractor, and drawings without re-solving (FR-008, FR-011). Only surface and placement
  changes re-solve.
- [ ] T035 [US1] Measure the four presets in the browser. Record in this file, under "Checkpoint
  notes", each preset's qualifying angle count at the default filters, the minimum connections
  that leave real repeating solutions, and the solve time. Ask the owner to (a) approve
  per-preset default `min` values and (b) answer the `receiveStep` question (research R6). Then
  update `src/surfaces/presets.ts` and `surface-types.ts`.

**Checkpoint**: US1 is fully usable. `pnpm test` is green, and quickstart.md US1 1–6 and Link 1–2
pass in a real browser. Stop and review before continuing.

---

## Phase 4: User Story 2 - Choose an angle on a protractor (Priority: P2)

**Goal**: A 0°–90° protractor with one identical mark for each qualifying angle, kept in sync
with the list.

**Independent Test**: quickstart.md US2 1–2.

- [ ] T036 [P] [US2] Write `tests/unit/protractor.test.ts` for the pure function
  `protractorMarks(angles: AngleTenths[], radius): {k, x1, y1, x2, y2}[]`: one mark for each
  angle; the angle 0° points along +X and 90° along +Y in SVG coordinates (Y flipped); output is
  in angle order.
- [ ] T037 [US2] Implement `src/render/protractor-svg.ts`: `protractorMarks` plus
  `renderProtractor(container, angles, selected, onSelect)`. The arc has ticks every 10°, and
  every mark is styled the same. The selected mark is outlined, with the same stroke as the others
  (FR-011b). The SVG has `role="img"` and an `aria-label` giving the qualifying count, and is
  `aria-hidden` for selection, because the list is the keyboard path (FR-015). Clicking a mark,
  or the nearest mark within 1°, calls `onSelect`.
- [ ] T038 [US2] Wire the protractor into `src/main.ts`, so that selecting an angle in the list or
  on the protractor updates both, and the link.

**Checkpoint**: quickstart.md US2 passes in the browser. US1 still passes.

---

## Phase 5: User Story 3 - See each surface as LEGO parts (Priority: P3)

**Goal**: Draw each surface on its own in its LEGO style, with highlighted connections, offset
parts, and connector positions, plus image downloads and the trim option.

**Independent Test**: quickstart.md US3 1–2, and US5 check 3 for trimming as shown on screen.

### Parts catalog

- [ ] T039 [US3] Write `scripts/build-catalog.ts` (as in Mountain's catalog; research R8). Download
  the Rebrickable `colors`, `sets`, `inventories`, and `inventory_parts` CSVs; record each URL's
  SHA-256. Keep a part and color only if they appear in a set from the current or previous year.
  Write `src/catalog/lego-angle-<YYYY-MM-DD>.json` in the data-model `Catalog` shape, limited to
  the R8 candidate parts and the default colors. Print a warning for any candidate part or default
  color that is not current.
- [ ] T040 [US3] Run `pnpm catalog`, commit the JSON, and record any non-current parts in this
  file's checkpoint notes with the substitute chosen (Constitution IV).
- [ ] T041 [P] [US3] Write `tests/unit/catalog.test.ts`, then `src/catalog/catalog.ts`:
  `loadCatalog()`, `part(no)`, `isCurrent(no, colorId)`, and `colorFor(no, preferredColorId)`,
  which falls back to the first current color in name order. Tests use a small fixture catalog.

### Build model

- [ ] T042 [P] [US3] Write `tests/unit/fractions.test.ts` for research R9. Plate at a half
  position adds no parts (the riser handles it). A Technic brick at an X half step adds one 6541
  part at the right position. A Technic wall at a Y position off the 12 LBU boundary adds plates
  above or below. A hybrid wall at every 4 LBU uses the 1 × 2 or 1 × 1 Technic piece with plates,
  as in the spec table.
- [ ] T043 [P] [US3] Write `tests/unit/connectors.test.ts` for FR-020a and research R8. Hole to
  hole gives 2780. A stud at a whole position gives 4073. A half step in one direction gives 15573,
  rotated along that direction. A half step in both gives 87580. Overlapping riser footprints add
  a warning.
- [ ] T044 [P] [US3] Write `tests/unit/trim.test.ts` for FR-020b. Trimming shrinks each surface to
  the smallest standard size covering all kept connections, rounding up to the next standard size.
  Walls shorten their layers and drop layers that hold no connections. The angle, placement, and
  connections do not change.
- [ ] T045 [US3] Fill in the `fractionRules`, `baseParts` (layout of each surface's base parts:
  for example 12 × 3703 for technicWall:150x132; for hybridWall, 4282 / 3703 / 4282 per 20 LBU
  layer), and `drawing` fields in `src/surfaces/surface-types.ts`, using the R8 part numbers.
- [ ] T046 [US3] Implement `src/build/fractions.ts` (makes T042 pass), `src/build/connectors.ts`
  (makes T043 pass), and `src/build/trim.ts` (makes T044 pass).
- [ ] T047 [US3] Implement `src/build/build.ts`: `makeBuild(solution, filters, options, config,
  catalog): Build`. Use the kept connections only. Put each surface's parts in its own coordinates,
  colored with the defaults (bottom light bluish gray, top dark bluish gray, connectors black,
  offset parts tan, via `colorFor`). Copy in `catalogVersion` and warnings. Add
  `tests/unit/build.test.ts`: every PlacedPart refers to a part and color that `isCurrent`
  accepts (FR-022), and the settings are copied in (FR-023).

### Drawings

- [ ] T048 [US3] Implement `src/render/surface-svg.ts`: `renderSurface(build, which: 'top' |
  'bottom'): SVGSVGElement`, drawn from the surface type's `drawing` and the Build. Brick: a top
  view with a row of studs. Liftarm: a rounded bar with a row of holes. Technic: a side view with
  holes on the edge. Plate and Baseplate: a top view with a stud grid. Technic wall: a side-view
  stack of 1 × 16 bricks with holes. Hybrid wall: a side-view stack of 4, 12, and 4 LBU layers.
  Highlight the binding points used, and draw offset parts and connectors in their catalog
  colors. Convert top-left origin and pixels here only, through `units.ts`. Use a `<title>` for
  accessibility.
- [ ] T049 [US3] Implement `src/export/image.ts`: `downloadSvg(svg, name)`, and
  `downloadPng(svg, name)` (2× scale through an off-screen canvas), using the file names in
  `contracts/exports.md`.
- [ ] T050 [US3] Add a "Trim to connections" checkbox to `src/ui/controls.ts`, and the `trim` key
  to `src/state/url-state.ts` (extend T023 with a trim round-trip). Wire up `src/main.ts` so that
  selecting an angle builds the Build and renders both drawings, with PNG/SVG download buttons,
  within 1 s (SC-003).
- [ ] T051 [US3] Physical prototype checkpoint (research R9). Build one half-step connection for
  each wall type, and record the outcome and any rule changes in this file's checkpoint notes.
  Fix `fractions.ts` and its tests if needed.

**Checkpoint**: quickstart.md US3 passes. US1 and US2 still pass.

---

## Phase 6: User Story 4 - Inspect the assembly in 3D (Priority: P4)

**Goal**: A rotatable 3D view of both surfaces at the selected angle, drawn from the Build.

**Independent Test**: quickstart.md US4 1–2.

- [ ] T052 [US4] Add `three` as a dependency and `@types/three` as a dev dependency (the plan's
  only runtime dependency besides the build).
- [ ] T053 [US4] Implement `src/render/view3d.ts`: `createView3d(container)` returns
  `{ show(build), savePng(name), dispose() }`. Draw stand-in geometry in LBU (research R10):
  boxes for bricks and plates, cylinders for studs, holes, pins, and risers. Place the bottom
  surface at the origin. The top surface is rotated by the angle and moved by the placement
  offset, raised to rest on the connectors. Use `OrbitControls` and
  `WebGLRenderer({ preserveDrawingBuffer: true })`, and redraw only when needed. Load the module
  lazily with dynamic `import()` the first time an angle is selected, so US1 loads quickly.
- [ ] T054 [US4] Add `tests/unit/view3d-placement.test.ts` for the pure function that
  `view3d.ts` uses (export it as `worldTransform(build, which)`). It checks that the world
  position of every connector on the top surface is within the connection's `errorLbu` of the
  matching bottom point (FR-018, FR-021).
- [ ] T055 [US4] Wire the 3D view and its "Save view" button into `src/main.ts`.

**Checkpoint**: quickstart.md US4 passes. Earlier stories still pass.

---

## Phase 7: User Story 5 - Download the build and parts list (Priority: P5)

**Goal**: LDraw build and CSV parts list downloads, both from the Build.

**Independent Test**: quickstart.md US5 1–3.

- [ ] T056 [P] [US5] Write `tests/contract/ldraw.test.ts`, as in `contracts/exports.md`. A
  structural parser checks that every line is type 0 or type 1; type-1 lines have 14 fields after
  the type, a 9-value matrix with 6 decimals, and positions with 4 decimals; `.dat` parts are in
  the catalog; lines end in CRLF. The header records the settings. There are exactly two `0 STEP`
  lines. Positions are LBU × 2, with Y negative for height.
- [ ] T057 [P] [US5] Write `tests/contract/csv.test.ts`. Header `Part,Name,Color,LDraw
  Color,Quantity`. Rows sorted by part number, then color name. Fields containing commas are
  quoted. **Invariant**: for each preset and a fixed angle, every row's quantity equals the
  number of matching type-1 lines in the LDraw output for the same Build.
- [ ] T058 [US5] Implement `src/export/ldraw.ts`: `toLdraw(build): string`, with the header and
  three steps (bottom with offset parts; connectors; top with offset parts). Top parts are moved
  into world coordinates with the shared `worldTransform` (T054). Makes T056 pass.
- [ ] T059 [US5] Implement `src/export/csv.ts`: `toCsv(build): string`. Makes T057 pass.
- [ ] T060 [US5] Add "Download build (.ldr)" and "Download parts (.csv)" buttons to
  `#downloads`, wired in `src/main.ts`, with file names as in `contracts/exports.md`.
- [ ] T061 [US5] Open one downloaded `.ldr` per preset in an LDraw viewer, and record the result
  in the checkpoint notes (SC-005).

**Checkpoint**: All five stories work. `pnpm test` is green.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Accessibility pass: every control can be reached and used from the keyboard in a
  sensible order; visible focus styles; AA contrast in light and dark themes; notices announced
  through `role="status"`.
- [ ] T063 [P] Phone-width pass: a single column at 375 px, no sideways page scrolling, and the
  protractor and 3D view scale to the screen width.
- [ ] T064 Performance check (SC-002, SC-003). Time all four presets in both placement modes, and
  baseplate on baseplate shifted, in Chrome and Firefox. Record the times. Confirm the over-budget
  path appears when the budget is lowered to 100 ms for testing.
- [ ] T065 [P] Write `README.md`: the project's purpose, the commands from quickstart.md, links to
  the spec, plan, and constitution, and the note on reference scripts.
- [ ] T066 Run every check in `specs/001-angle-designer/quickstart.md` and record the results.
- [ ] T067 Deploy. Connect the GitHub repo to Render using `render.yaml`. The owner adds the
  `angle.thronebuilder.com` CNAME in ThroneBuilder DNS and checks HTTPS. Open a shared link from
  production in a fresh browser (SC-008).
- [ ] T068 Physical build check (SC-007). Build one downloaded solution from each preset and record
  the result in the checkpoint notes.

---

## Checkpoint notes

_Record measurements, owner decisions, and prototype results here as tasks are completed (T035,
T040, T051, T061, T064, T066, T068)._

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks every story.
- **US1 (Phase 3)**: after Foundational. It is the MVP.
- **US2 (Phase 4)**: needs the US1 results and selection (T032, T034).
- **US3 (Phase 5)**: needs US1 (an angle solution to draw). Does not need US2.
- **US4 (Phase 6)**: needs the US3 Build model (T047). Does not need the drawings.
- **US5 (Phase 7)**: needs the US3 Build (T047) and the US4 `worldTransform` (T054).
- **Polish (Phase 8)**: after the stories you plan to ship.

### Within each story

- Tests first (they must fail), then implementation, then wiring into `src/main.ts`, then the
  browser checkpoint.
- Within US1: T024 → T025 → T026 → T027 → T028 → T029; T030 can run alongside the solver tasks;
  T031–T034 come after T027–T030.

### Parallel opportunities

- Setup: T003–T007 alongside each other once T002 is done.
- Foundational: T009/T010, T011, T012, and T013 alongside each other; T014 and T015 after T012.
- US1 tests: T017–T023 alongside each other (T017 needs the fixtures from T016).
- US3: T041–T044 alongside each other once T040 has produced the catalog.
- US5: T056 and T057 alongside each other.

## Parallel example: User Story 1

```text
Task: "Write tests/unit/centered.test.ts"            (T018)
Task: "Write tests/unit/circle.test.ts"              (T019)
Task: "Write tests/unit/shifted.test.ts"             (T020)
Task: "Write tests/unit/filter.test.ts"              (T021)
Task: "Write tests/contract/solver-determinism.test.ts" (T022)
Task: "Write tests/contract/url-state.test.ts"       (T023)
```

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 US1, including the T035 measurements and owner decisions.
3. **Stop and check**: quickstart US1 and Link in a real browser. Optionally deploy (T067) so the
   angle finder is usable on its own.

### Incremental delivery

US1 → US2 (protractor) → US3 (drawings, catalog, trim) → US4 (3D) → US5 (downloads). Each one
ends with its quickstart checkpoint and a commit. Do not start the next story until the current
checkpoint passes (Constitution VI).
