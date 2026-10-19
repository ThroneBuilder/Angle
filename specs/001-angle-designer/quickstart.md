# Quickstart: Angle Designer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run the project and check each user story end to end. Formats and messages are defined in
[contracts/](./contracts/), and the data shapes in [data-model.md](./data-model.md).

## Prerequisites

- Node 24 LTS and pnpm 11 (Windows 11 with Smart App Control left on; use `node` and `pnpm`
  directly, without launcher wrappers that need security changes).
- An LDraw viewer for checking exported files (for example, LDView or BrickLink Studio).

## Setup and commands

```powershell
pnpm install
pnpm test            # all deterministic tests, including golden fixtures
pnpm dev             # local dev server, http://localhost:5173
pnpm build           # static site in dist/
pnpm preview         # serves dist/ to check the production build
pnpm catalog         # rebuilds catalog/lego-angle-<date>.json from a Rebrickable snapshot
```

## Checks by user story

Each checkpoint is done in a real browser (Constitution VI), and its outcome is recorded in
`tasks.md`.

### US1: Find angles (P1)

1. `pnpm test` passes, including `tests/fixtures/*.json` from the reference scripts (SC-001).
2. Open the page and pick each of the four presets. The angle list fills in within 10 seconds,
   and the page stays usable while it does (SC-002).
3. Switch to Custom. The values and the list stay the same (FR-003).
4. Lower the tolerance to 0.2. Angles disappear immediately, with no solve progress shown
   (tolerance is a filter). Set it to 0, and the empty-state message explains exact matches.
   Raise minimum connections to 4. Fewer angles
   remain. Set a minimum spacing of 4. Counts drop (FR-011e).
5. Switch to shifted placement. The connection count for each angle is the same or higher, and
   each angle shows an offset (FR-007a, FR-007b).
6. Change the configuration in the middle of a solve. Progress restarts, and no old results
   appear (FR-013).

### US2: Protractor and match map (P2)

1. Every listed solution has one protractor dot at its build angle, at the same distance from the
   center as its height on the match map, in the same color (FR-014a).
2. Click a mark, and the list and match map select it. Use the keyboard on the list, and the
   protractor and match map follow (FR-015).
3. On Technic on wall, the match map shows each solution at its build angle and spacing, colored
   by worst error. Raise the tolerance, and points are added, mostly at short spacings.
4. Hover over a match-map point: its build angle, input angles, connections, worst error, spacing,
   span, dx, and dy are shown. Click it: the list and protractor select the same solution.
5. Choose "Plot: Connections": both charts change together. Choose "Max worst error ≤ 0.10": points
   with larger errors leave both charts and the list, and the link gains `emax=0.1` (FR-011f).

### US3: Surface drawings (P3)

1. For an angle with half-step connections in each preset, the drawings show the right view,
   highlighted connections, and offset parts (FR-016, FR-017).
2. Download PNG and SVG images. They open and match the screen (FR-019).

### US4: 3D view (P4)

1. Drag to rotate. The top surface sits at the selected angle, and the connectors line up with
   the 2D highlights (FR-018).
2. Save the view as a PNG.

### US5: Downloads (P5)

1. Download the `.ldr` file. It opens in the LDraw viewer without errors and shows the same
   assembly as the 3D view (SC-005).
2. Download the `.csv` file. Its quantities match the LDraw file (the invariant test also checks
   this).
3. Turn on "trim to connections". The surfaces shrink in every view and in both downloads, and
   the angle and connections stay the same (FR-020b).

### Link

1. Copy the link and open it in a different browser. The same angle, connections, and downloads
   appear (SC-008).
2. Open `?bottom=liftarm:140`. The page opens with defaults and a notice (FR-025).

### Physical check (SC-007)

Build one downloaded solution from each preset. Every connection fits without forcing. Record
the result, and any changes to the wall offset rules (research R9).
