# Implementation Plan: Angle Designer

**Branch**: `001-angle-designer` (spec directory; git is still on `master`) | **Date**: 2026-10-19 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-angle-designer/spec.md`

## Summary

A static, browser-only page at angle.thronebuilder.com that finds every angle (0.1°–89.9°) at
which two LEGO surfaces connect within a tolerance. The builder picks the angle from a list or a
protractor, then sees each surface drawn as LEGO parts, a rotatable 3D view, and downloads the
LDraw build, CSV parts list, and images.

Technical approach:
- **One solver**, configured entirely by surface data. Centered matching uses rounding against
  the bottom grid (O(n) per angle). Optional shifted placement searches one bottom grid cell for
  the best offset, then refines it to the smallest worst error.
- **Determinism** comes from a committed sine/cosine table indexed by tenths of a degree, and
  from comparing squared distances.
- **Solve once, filter afterwards**: matches are calculated at a fixed 1.0 LBU, and the
  builder's tolerance (0–1.0), minimum connections, and spacing are all filters, so changing them
  never recalculates (research R15).
- **The solver runs in a Web Worker** in chunks of 10 angles, pausing after each chunk so it can
  be cancelled, with progress and a 10-second budget.
- **One Build model** drives the SVG drawings, the three.js view, the LDraw file, and the CSV.
- **The design is kept in the link** (query string).

## Technical Context

**Language/Version**: TypeScript 5.x, `strict: true`. Node 24 LTS for tooling only.

**Primary Dependencies**: Vite (build and dev server), three.js (3D view). Dev only: Vitest,
`@types/three`. No UI framework (research R1).

**Storage**: None on a server. The design lives in the URL query string
([contracts/url-state.md](./contracts/url-state.md)). The versioned parts catalog is a committed
JSON file shipped with the page.

**Testing**: Vitest unit and contract tests, plus golden fixtures from the reference scripts
(produced once, outside the product). A manual browser check at each user-story checkpoint
(research R14).

**Target Platform**: Current desktop Chrome, Edge, Firefox, and Safari. Phone layouts work but
are not optimized. Static hosting on Render.

**Project Type**: Static single-page web application (no backend).

**Performance Goals**: All 899 angles for any preset within 10 s (expected under 1 s for presets,
and a few seconds for baseplate on baseplate in shifted mode). Drawings and 3D view within 1 s of
selecting an angle. Filter changes within 100 ms, with no re-solve.

**Constraints**: Identical solver results in every browser. No main-thread blocking during a
solve. No third-party analytics. Only currently produced LEGO parts and colors. Development on
Windows 11 with Smart App Control left on.

**Scale/Scope**: 1 page, 7 surface types, 4 presets, up to 3,969 binding points per surface,
899 angles, 5 user stories.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|-----------|------|--------------|-------------|
| I. Geometric Truth in LBU | All geometry in LBU; one conversion module; rotation about the shared center; offset optional and reported; tolerance visible; error per connection; reference scripts used for checking | ✅ | ✅ `units.ts` only (R11); R3/R4 rotate about the center; `Placement` reported; `Connection.errorLbu`; fixtures (R14) |
| II. One Solver, Surfaces by Configuration | One solver; surfaces as data; presets = Custom; mirror shortcut not used | ✅ | ✅ `SurfaceType` data including `fractionRules` (R9); solver has no type branches; url-state test that a preset equals Custom |
| III. Browser-Only & Deterministic | Static; worker with progress and cancel; fallback when over budget; identical results; no analytics | ✅ | ✅ R2 trig table + squared distances; worker contract; `overBudget` → single angle |
| IV. Physically Buildable Results | Current parts only, versioned catalog; offset parts are real parts; filters don't change geometry; assumptions stated | ✅ | ✅ R8 catalog; R9 rules; filters applied after solving; header lines in LDraw/CSV state the settings |
| V. One Solution Model, Many Views | One Build model; LDraw is the main export and valid; CSV = LDraw; 3D matches 2D | ✅ | ✅ `Build` entity; exports contract with tested invariant |
| VI. Incremental, Test-Gated Delivery | Small slices; deterministic stages tested; fixtures deliberate; browser check per slice | ✅ | ✅ Stories P1–P5 are delivered in order; quickstart lists the checkpoints |
| Tech & hosting | TypeScript strict; minimal dependencies; Render from GitHub; keyboard-operable; list = protractor | ✅ | ✅ 2 runtime dependencies (Vite is build-only, three.js); FR-015 |

No violations. Complexity Tracking is empty.

**Open items to settle during implementation**, recorded as research findings, not gate failures:
- **R6, solution density**: suggested minimum-connections default per preset, and whether the
  top surface's receiving positions are whole positions only (`receiveStep`).
- **R8, parts**: confirm the 32 × 32 baseplate, and that every candidate part is currently
  produced.
- **R9, wall offset rules**: confirm with physical prototypes.

## Project Structure

### Documentation (this feature)

```text
specs/001-angle-designer/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R15
├── data-model.md        # Phase 1: entities and relationships
├── quickstart.md        # Phase 1: run and check guide
├── contracts/
│   ├── url-state.md     # Design link format
│   ├── solver-worker.md # Worker messages and determinism
│   └── exports.md       # LDraw, CSV, image formats
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html                      # Single page
src/
├── main.ts                     # Wires state, worker, and views together
├── geometry/
│   ├── units.ts                # LBU ↔ LDU / pixels (the only conversion point)
│   ├── trig-table.ts           # Generated sin/cos for 0–900 tenths (committed)
│   └── circle.ts               # Smallest enclosing circle (Welzl, fixed order)
├── surfaces/
│   ├── surface-types.ts        # The 7 SurfaceType records
│   └── presets.ts              # The 4 presets as Configurations
├── solver/
│   ├── constants.ts            # SOLVE_TOLERANCE_LBU = 1.0 (R15)
│   ├── grid.ts                 # Binding points from a SurfaceSpec
│   ├── centered.ts             # R3
│   ├── shifted.ts              # R4
│   ├── solve.ts                # solveRange(config, from, to) / solveAngle(config, k)
│   ├── filter.ts               # Tolerance, spacing, collinearity, qualify (R5)
│   ├── packing.ts              # SolveResult ↔ typed arrays (R15)
│   ├── worker.ts               # Worker wrapper (contracts/solver-worker.md)
│   └── client.ts               # Page side of the worker
├── build/
│   ├── build.ts                # AngleSolution → Build
│   ├── connectors.ts           # FR-020a
│   ├── fractions.ts            # FR-017, research R9
│   └── trim.ts                 # FR-020b
├── catalog/
│   ├── catalog.ts              # Load and look up parts and colors
│   └── lego-angle-<date>.json  # Generated, committed
├── export/
│   ├── ldraw.ts
│   ├── csv.ts
│   └── image.ts
├── render/
│   ├── surface-svg.ts          # 2D drawings
│   ├── protractor-svg.ts
│   └── view3d.ts               # three.js
├── state/
│   └── url-state.ts            # contracts/url-state.md
└── ui/
    ├── controls.ts             # Presets, surfaces, tolerance, placement, filters, trim
    ├── angle-list.ts
    └── notices.ts
scripts/
├── gen-trig-table.ts           # Writes src/geometry/trig-table.ts
└── build-catalog.ts            # Rebrickable snapshot → catalog JSON
reference/                      # FloorAngles.ps1, PythagoreanTriples.ps1, DoubleAngles.ps1 (not shipped)
tests/
├── fixtures/                   # Golden JSON from the reference scripts
├── unit/                       # geometry, solver, filter, build, catalog
└── contract/                   # url-state, solver determinism, ldraw/csv invariants
render.yaml                     # Render static site
```

**Structure Decision**: A single project with no backend, since everything runs in the browser
(Constitution III). The modules follow the data flow solve → filter → build → render/export, so
each user story adds whole folders: US1 = geometry, surfaces, solver, state, ui; US2 = protractor;
US3 = catalog, build, render/surface-svg, image; US4 = view3d; US5 = export/ldraw, export/csv. The reference
scripts move from the repository root to `reference/` and are never imported.

## Complexity Tracking

No constitution violations to justify.
