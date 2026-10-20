# Research: Angle Designer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-19

Each entry records a decision, why it was made, and what else was considered. All "NEEDS
CLARIFICATION" items from the Technical Context are resolved here.

---

## R1. Application stack

**Decision**: A static single-page app: TypeScript 5.x (`strict: true`) built with Vite, with no
UI framework. The DOM and SVG are written directly in small modules. three.js is used for the 3D
view. Vitest runs the tests. pnpm manages packages, and Node 24 LTS is used for tooling only.

**Rationale**: The constitution requires browser-only, static hosting, and strict TypeScript.
There is a single page with a modest number of controls (two surface pickers, a few numeric
inputs, a list, a protractor, drawings, a 3D view), so a component framework would add
dependencies without solving a real problem. Vite gives a dev server, module workers, and a
static `dist/` with almost no configuration. Faceplate already uses pnpm, Vitest, and Render
static hosting, so the tooling stays familiar.

**Alternatives considered**:
- *Astro (as in Faceplate)*: built for content sites with islands. Angle is one interactive tool,
  so Astro's page model adds nothing.
- *React/Preact*: helpful if the UI grows. Revisit only if hand-written DOM updates become
  error-prone (constitution: each dependency must be justified).
- *Babylon.js for 3D*: capable, but larger. three.js is the more established, lighter choice for
  simple rotatable geometry.

## R2. Deterministic trigonometry

**Decision**: Angles are integers in tenths of a degree (`k` = 1…899). Rotation uses a generated,
committed table of `cos` and `sin` for `k` = 0…900, written as exact double literals. The solver
never calls `Math.sin` or `Math.cos`. Distance checks compare squared distances with
`SOLVE_TOLERANCE_LBU²` (R15), so no square root is needed when deciding a match.

**Rationale**: ECMAScript defines `Math.sin` and `Math.cos` as implementation-approximated, so
results can differ in the last bit between browser engines. A point that sits exactly on the
tolerance boundary could then match in one browser and not in another, which breaks FR-012 and
SC-006. Addition and multiplication of doubles are correctly rounded everywhere, so a fixed table
plus `+` and `*` gives identical results in every engine. Integer tenths also make angle identity
exact (no `0.30000000000000004` keys).

**Alternatives considered**:
- *`Math.sin`/`Math.cos` with rounding to 1e-9*: lowers the risk but does not remove it at
  rounding boundaries.
- *A ported fdlibm `sin`*: deterministic, but more code than a 901-entry table, and arbitrary
  angles are not needed. A single angle the builder enters is also limited to 0.1° steps.

## R3. Centered matching

**Decision**: For each angle, rotate every top binding point about the shared center. The bottom
surface is a regular grid, so the nearest bottom point is found by rounding
(`round(x / stepX) * stepX`, and the same for Y), then checking bounds and the squared distance.
Cost is O(top points) per angle.

**Rationale**: No pair-by-pair search is needed (the reference script compares every pair, which
is O(n²)). For the largest case, baseplate on baseplate (63 × 63 = 3,969 points at 5 LBU steps),
that is about 3.6 million point tests for all 899 angles, which takes milliseconds.

**Alternatives considered**: All-pairs comparison or a spatial hash. Both are slower or more
complex, and neither is needed because the bottom grid is regular.

## R4. Shifted placement (FR-007a–c)

**Decision**: For each angle:

1. **Residues**: For each rotated top point, compute its position modulo the bottom step
   (`stepX`, `stepY`). This puts every point inside one bottom cell, treated as a torus (its
   edges wrap around).
2. **Coverage grid**: Lay a grid over the cell at a resolution of `h = SOLVE_TOLERANCE_LBU / 5`
   (R15). For each residue, add 1 to every grid cell within `SOLVE_TOLERANCE_LBU` of the offset that would land that point
   exactly on a grid corner. The grid cell with the highest count gives the approximate best
   offset within the cell. Ties go to the cell nearest offset (0, 0), scanning in a fixed order.
3. **Refine**: Take the points that connect at that approximate offset. Compute the smallest
   enclosing circle of their required offsets (Welzl's algorithm on a fixed, sorted input order).
   Its center is the refined in-cell offset, and its radius is the worst error. If the radius is
   larger than `SOLVE_TOLERANCE_LBU`, keep the approximate offset.
4. **Whole-step placement**: An in-cell offset can be placed on the surface in several ways
   (plus a whole number of steps in X and Y). Try each placement within half the bottom surface's
   size of centered. Count connections whose bottom point is on the surface, then pick by FR-007c:
   most connections, then smallest worst error, then nearest to centered, then a fixed
   tie-breaker (smaller |X|, then smaller |Y|, then positive before negative).
5. Compare with the centered result for the same angle. Keep the shifted placement only if it
   has more connections, or the same number with a smaller worst error (FR-007a).

**Rationale**: Moving the top surface by one whole bottom step gives the same set of matches,
apart from the edges. So the search only needs to cover one small cell (for example 5 × 4 LBU),
not the whole surface. No single connection is forced to zero error: the refine step spreads the
error evenly across all connections. Cost per angle is about (top points × π·25 ≈ 79) grid
updates. For a 16 × 16 plate on a plate (961 points) that is about 76,000 per angle, or roughly
68 million for all angles (about a second). For baseplate on baseplate (3,969 points) it is about
313,000 per angle, roughly 282 million for all angles. That takes a few seconds in a worker, and
is the case the 10-second budget in R7 protects.

**Alternatives considered**:
- *Anchor one pair exactly (the reference scripts' method)*: forces zero error at that pair and
  can miss solutions where every connection is slightly off. This is the problem the owner
  pointed out.
- *Exact maximum-coverage geometry (testing every point where two disks cross)*: exact, but O(n³)
  per angle. Too slow for large surfaces, and the grid-then-refine method finds the same answer in
  practice.

## R5. Qualifying, spacing filter, and collinearity

_Revised 2026-10-19: the gap filter below was replaced by the spacing filter (spec FR-011e), which
walks top points in order and measures between top points, in top units._

**Decision**:
- **Gap filter**: Sort connections by bottom grid index (Y, then X). Keep a connection only if it
  is at least `gap` from every connection already kept. This always gives the same result.
- **Collinearity** (2D tops): the connections qualify if any three bottom points have a non-zero
  cross product. Bottom points are compared by their integer grid indices, so the test is exact.
  It stops at the first non-collinear triple, so it costs O(n) in practice.
- **Qualify**: at least 2 connections for a 1D top, or at least 3 not all on one line for a 2D
  top (FR-011a), counted after the gap filter.
- **Tolerance filter** (applied first): drop connections whose `errorLbu` is greater than the
  chosen tolerance. A tolerance of 0 keeps only connections with zero error.
- Filters run on the stored per-angle results, in this order: tolerance, gap, qualify. Changing
  any filter, including tolerance, never re-runs the solver (FR-008, FR-011; see R15).

**Rationale**: Exact integer tests and a fixed order give results that never vary (FR-012).

## R6. Expected solution density (risk)

**Finding**: With a 0.5 LBU tolerance and a 5 × 5 LBU bottom cell, a random rotated point lands
within tolerance of a grid point about π·0.5² / 25 ≈ 3% of the time. A 16 × 16 plate top has 961
binding points at 5 LBU steps, so about 30 chance connections are expected at *any* angle. That is
enough for nearly every angle to qualify as an area top. The default presets would then show
almost the whole protractor.

**Decision**: Ship the binary rule as specified. Show, next to the filters, how many angles
qualify, so the builder can see the effect of raising minimum connections or gap. While building
User Story 1, check the presets and record a suggested minimum-connections value per preset. If
the owner agrees, it becomes the preset's default.

**Open question for the owner**: Can every grid point on the *top* surface receive a connection?
The underside of a plate takes a stud only at whole stud positions, and half positions come from
risers on the bottom. If the receiving side is whole positions only, a 16 × 16 top has 256
binding points instead of 961, and chance matches drop accordingly. The data model supports this
with a separate top-side step per surface type (`receiveStep`), which defaults to the table's
step until the owner decides.

**Rationale**: The owner chose filters over ranking. Real solutions repeat in a regular pattern,
so their count grows with surface size, while chance matches stay scattered. A higher minimum or
gap separates them.

## R7. Running the solver off the main thread (FR-013)

**Decision**: The solver runs in a module Web Worker. It solves in chunks of 10 angles. After
each chunk it posts progress and pauses briefly (`await` on a zero-delay timer), so the worker
can receive a `cancel` message. When the builder changes the configuration, the page sends
`cancel`, starts a new generation, and ignores messages from older ones. Terminating the worker
is kept only as a fallback, if a chunk fails to yield within 200 ms. The
time budget is 10 seconds (SC-002). If an estimate (top points × angles × cost per point, measured
on the first 10 angles) predicts more than the budget, the worker stops and the page offers to
solve a single angle the builder enters.

**Alternatives considered**: Slicing the work on the main thread with `requestIdleCallback`. This
is simpler, but the page stays less responsive, and cancelling is harder to get right.

## R8. Parts and the parts catalog (FR-022, Constitution IV)

**Decision**: Reuse Mountain's approach. A script builds a versioned catalog
(`catalog/lego-angle-YYYY-MM-DD.json`) from a dated Rebrickable snapshot. A part and color are
"currently produced" if they appear in a set released in the current or previous year. The
catalog is committed, and the page ships with it.

The candidate parts are below. Each must be confirmed by the catalog script; if one is not
current, the build step reports it and a current substitute is chosen.

| Use | Part (LDraw no.) |
|-----|------------------|
| Brick surface | Brick 1 × 16 (2465) |
| Liftarm surface | Technic liftarm 1 × 15 thick (64871) |
| Technic surface / Technic wall layer | Technic brick 1 × 16 (3703) |
| Plate surface | Plate 16 × 16 (91405) |
| Baseplate surface | Baseplate 32 × 32 (3811) |
| Hybrid wall plate layers | Plate 2 × 16 (4282) |
| Stud connector, whole position | Round plate 1 × 1 (4073) |
| Stud connector, half position in one direction | Jumper plate 1 × 2 (15573) |
| Stud connector, half position in both directions | Jumper plate 2 × 2 (87580) |
| Hole connector | Technic pin with friction (2780) |
| Half-step hole offset | Technic brick 1 × 1 with hole (6541) |
| Extra height (walls) | Plate 1 × 1 (3024) / Plate 1 × 2 (3023) |

**Substitutes found by the catalog script (2026-10-19):** friction pin 2780 → 61332, round plate
1 x 1 4073 → 6141, 15-hole thick liftarm 64871 → 32278. Hybrid wall plates are 1 x N plates
(3024 … 60479), not 4282. The full candidate list is `src/catalog/candidates.ts`.

The spec's table says "32x31 Baseplate", but its maximum (310 × 310 LBU) matches a 32 × 32
baseplate, so 32 × 32 is used. The owner should confirm this.

**Stud connections**: When a stud surface is at an angle, a top part cannot rest on the bottom's
studs except where they connect. Each stud connection therefore uses a one-plate-tall riser on the
bottom surface (round plate, 1 × 2 jumper, or 2 × 2 jumper, depending on whether the position is
whole or half). The top surface sits on the risers, clear of the other studs. The build checks
that risers do not overlap; overlapping connections are reported, and the gap filter can remove
them.

## R9. Building fractional positions (FR-017)

**Decision**: Each surface type has rules for turning a binding point's grid position into the
parts that create it. The rules are data in the surface type, so the solver contains no
surface-specific code (Constitution II).
- **Plate / Baseplate**: the half positions come from the riser (R8). No other parts are needed.
- **Technic brick / Technic wall**: an X half step uses a 1 × 1 Technic brick with hole, which
  puts its hole between the 1 × 16 brick's holes. A Y position that is not on a 12 LBU layer
  boundary adds plates above or below.
- **Hybrid wall**: positions every 4 LBU come from extra plates above or below a 1 × 2 Technic
  piece (centered on an edge) or a 1 × 1 Technic piece (centered on a brick), as in the spec's
  table.

The exact rules for the walls need checking against physical prototypes (Constitution workflow,
"Open questions"), and the outcome is recorded in the tasks.

## R10. 3D view

**Decision**: three.js, with simple stand-in geometry made from boxes and cylinders sized in
LBU: surfaces, studs or holes, connectors, and offset parts. It uses `OrbitControls` for rotation.
`preserveDrawingBuffer: true` lets the current view be saved as a PNG. The 3D view uses the same
Build model as the LDraw export (Constitution V).

**Rationale**: Shipping real LDraw part meshes would mean bundling and parsing the LDraw
library, which is large and has its own license terms. Stand-in geometry is enough to check the
angle and the connections. Detailed rendering is the job of LDraw tools, opened from the
downloaded file.

## R11. Units and LDraw output

**Decision**: 1 LBU = 2 LDU, an exact integer conversion done in `units.ts` only. LDraw's Y axis
points down, so heights become negative Y. The output is one `.ldr` file, with comment lines
recording the settings (FR-023). Rotation matrices are written to 6 decimal places. Positions
rotated by the angle are written to 4 decimal places in LDU. Colors are LDraw color codes taken
from the catalog.

**Rationale**: In LBU, the stud-to-stud distance (a brick's width) is 10 and a brick's height
is 12. LDraw's LDU is exactly half the size: 20 stud-to-stud and 24 per brick height. One tested
conversion point keeps the two from being mixed up.

## R12. Link state (FR-024, FR-025)

**Decision**: The design is kept in the URL query string using `URLSearchParams` (schema in
[contracts/url-state.md](./contracts/url-state.md)). The page updates it with `replaceState` on
every change, and adds a history entry with `pushState` only when the builder selects an angle.
A version parameter `v=1` allows the format to change later. Invalid values fall back to the
preset's defaults, and a notice lists them.

## R13. Hosting

**Decision**: A Render static site built from GitHub (`render.yaml`), as in Faceplate, with the
custom domain `angle.thronebuilder.com` added as a CNAME in ThroneBuilder's DNS. There is no
server code.

## R14. Testing

**Decision**: Vitest for all deterministic stages: trig table, units, centered and shifted
solving, filters, build, connectors, trimming, LDraw, CSV, and URL state. Golden fixtures live in
`tests/fixtures/` as JSON. They were produced once by running the reference PowerShell scripts
outside the product (the scripts are moved to `reference/` and are never imported or shipped).
LDraw output is checked by a structural parser test, and by opening it by hand in an LDraw viewer
at each checkpoint. Browser behavior is checked by hand at each user-story checkpoint
(Constitution VI). Browser automation is not added for now.

**Rationale**: The deterministic core holds nearly all the risk, and it can be tested in Node.
Cross-browser identity (SC-006) is guaranteed by construction (R2), so a cross-browser test
runner would add a large dependency for little gain.

**Reference script units**: The scripts count positions in whole steps, not LBU. One step of
`dx` is the stud-to-stud distance (10 LBU), and one step of `dy` is a brick height (12 LBU) in
`PythagoreanTriples.ps1`, or the stud-to-stud distance (10 LBU) in `FloorAngles.ps1`. Their
`$xlbu = 5` / `$ylbu = 6` values are only the 10 : 12 ratio halved. A liftarm length `L` is
`L × 10` LBU. The fixture exporter converts to LBU before writing.

## R15. Solve once, filter tolerance afterwards

**Decision**: The solver always uses a fixed solve tolerance, `SOLVE_TOLERANCE_LBU = 1.0`, the
largest value the tolerance control allows. Every connection within 1.0 LBU is stored with its
error. The tolerance the builder chooses (0 to 1.0, default 0.5) is a filter, applied after
solving (R5). Changing it updates the list, protractor, and drawings without recalculating.

**Rationale**: This is what Constitution IV and FR-011 require: filters change only what is
shown. 1.0 LBU is twice the observed pin tolerance, and it stays below half the smallest step
(4 LBU / 2), so rounding to the nearest bottom point (R3) still finds the only candidate.

**Shifted mode, revised during implementation (2026-10-19)**: Choosing one offset at 1.0 LBU
turned out to lose real solutions, not just a connection or two. A loose pair near 0.99 LBU tied
with an exact 3-4-5 pair, won, and was then removed by the 0.5 filter (golden fixtures failed). The
solver now optimizes shifted placement separately at each tolerance level in
`TIERS_LBU = [0.25, 0.5, 0.75, 1.0]`, still all up front, and stores each distinct placement with a
`tierMask`. The filter uses the placement for the smallest level at or above the chosen tolerance.
Changing the tolerance therefore never re-solves, but crossing a level can show a different stored
placement. Centered placement serves every level. Cost: about 4–6 s for all angles on area-on-area
presets in Node.

**Data volume**: At 1.0 LBU, about 12.6% of top points connect at a typical angle (π·1² / 25).
For a plate on a plate, that is about 120 connections per angle and about 110,000 for all
angles. For baseplate on baseplate it is about 450,000. The worker sends connections as packed
typed arrays (`Int16Array` for grid indices, `Float32Array` for errors), transferred rather than
copied, about 5 MB for the largest case. The page reads them per angle as needed.

**Alternatives considered**: Re-solving whenever the tolerance changes. This is simpler, but it
breaks Constitution IV, and it makes tolerance changes slow on large surfaces.
