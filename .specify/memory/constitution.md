<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles: N/A (initial constitution; all principles are new)
  - I.   Geometric Truth in LBU
  - II.  One Solver, Surfaces by Configuration
  - III. Browser-Only & Deterministic
  - IV.  Physically Buildable Results
  - V.   One Solution Model, Many Views
  - VI.  Incremental, Test-Gated Delivery
- Added sections:
  - Core Principles (I–VI)
  - Technology, Hosting & Constraints
  - Development Workflow & Quality Gates
  - Governance
- Removed sections: none
- Templates: not modified (dependent templates read this file at runtime)
- Deferred TODOs: none
- Notes: Conventions aligned with sibling LEGO projects Faceplate (browser-only, deterministic,
  TypeScript strict) and Mountain (LDraw primary export, currently produced parts only,
  Windows 11 Smart App Control), and hosted under the ThroneBuilder domain.
-->

# Angle Constitution

## Core Principles

### I. Geometric Truth in LBU

Angle exists to find connection points where two LEGO surfaces meet at a chosen angle. Every
answer it gives MUST be geometrically exact and explainable.

- All internal geometry MUST be expressed in LEGO Base Units (LBU): a brick is 10 LBU wide and
  12 LBU high. Conversions to other units (pixels, LDraw LDU, studs) MUST happen only at the
  output boundary, through a single, tested conversion module.
- The solver MUST use a centered origin for both surfaces when rotating and matching points.
  Conversion to a top-left origin is a rendering concern only and MUST NOT affect matching.
- Match tolerance MUST be an explicit, user-visible parameter. The default is 0.5 LBU (observed
  pin tolerance), and the user MUST be able to change it.
- Every reported connection MUST carry its measured positional error in LBU. A solution MUST NOT
  be reported as matching unless every one of its listed connections is within the active
  tolerance.
- `FloorAngles.ps1`, `PythagoreanTriples.ps1`, and `DoubleAngles.ps1` are the reference oracles.
  For equivalent inputs, the web solver MUST reproduce their matches, or the difference MUST be
  documented and justified as a correction.

Rationale: a builder commits to drilling down a design only if the angles and hole positions
can be trusted before any parts are bought or pressed together.

### II. One Solver, Surfaces by Configuration

- There MUST be one general matching solver (grid of binding points per surface, rotate top
  surface about the common centered origin, match within tolerance). Brick-on-plate,
  liftarm-on-wall, and wall-on-wall MUST be configurations of that solver, not separate
  algorithms.
- Surfaces (Brick, Liftarm, Technic, Plate, Baseplate, Technic Wall, Hybrid Wall, and any added
  later) MUST be defined as data: X/Y step, X/Y max, dimensionality (1D or 2D), default size,
  edge offset, and rendering style. The solver MUST NOT contain surface-specific branches.
- Every preset MUST map exactly to a Custom-mode configuration. Choosing a preset and then
  switching to Custom MUST show the same values, and produce the same results.
- The bottom surface MUST be 2D. The top surface MAY be 1D or 2D.
- Shortcuts (for example, the mirror-image half-angle pattern for wall-on-wall) MAY be added as
  optimizations or presentation aids only. They MUST be validated against the general solver and
  MUST NOT replace it.

Rationale: generality costs little when kept from the start; separate per-case algorithms
drift apart and multiply bugs.

### III. Browser-Only & Deterministic

- Angle MUST be a static web application. All computation, rendering, and file generation MUST
  run in the user's browser. No backend, user accounts, or server-side storage are permitted
  without an amendment.
- The solver MUST produce identical results for identical inputs on every run and in every
  supported browser. Matching MUST NOT depend on rendering, canvas behavior, or iteration order
  of unordered collections.
- Long computations (such as pre-calculating every angle from 0.1° to 89.9° in 0.1° steps) MUST
  run off the main thread, MUST report progress, and MUST be cancellable. The UI MUST stay
  responsive while they run.
- If full pre-calculation cannot meet the plan's measured performance budget for a
  configuration, the app MUST fall back to on-demand calculation rather than block the user.
- No third-party analytics or tracking scripts.

Rationale: a static, deterministic tool is cheap to host, easy to test, and gives every builder
the same answer.

### IV. Physically Buildable Results

- Every rendered build, LDraw file, and parts list MUST use only real LEGO parts that LEGO
  currently produces, in currently produced colors. Retired parts and third-party or clone
  elements MUST NOT be used. The part catalog MUST be versioned and record its source and date.
- Fractional spacing (half-stud offsets, jumper plates, 1×1 Technic bricks, extra plates in hybrid
  walls) MUST be expressed with the actual parts that produce it, as listed in the surface
  definition. It MUST NOT be drawn as an abstract offset.
- Solution filters (tolerance, minimum matched connections, minimum gap between connections)
  MUST change only which solutions are shown. They MUST NOT change the solver's geometry.
- Results MUST state their assumptions: active tolerance, surface definitions, and the catalog
  version used.

Rationale: the output is a building instruction. Anything that cannot be built from real parts
is noise.

### V. One Solution Model, Many Views

- A chosen solution MUST be represented by one canonical data model (surfaces, angle,
  connections, per-connection error, parts). The 2D surface renderings, the 3D view, image
  downloads, the LDraw file, and the CSV parts list MUST all be derived from that model.
- LDraw (`.ldr`/`.mpd`) is the primary build export and MUST parse as valid LDraw. LBU-to-LDU
  conversion MUST be exact and covered by tests.
- The CSV parts list MUST match the parts in the LDraw export exactly, by part and color.
- The 3D view MUST be rotatable by the user, and MUST visibly show the same connections as the
  2D views.

Rationale: when every view comes from one model, the picture, the file, and the shopping list
cannot disagree.

### VI. Incremental, Test-Gated Delivery

- Features MUST be delivered in small, independently testable slices, and each slice MUST be
  verified in a real browser before the next one begins.
- Deterministic stages (grid generation, rotation, matching, filtering, unit conversion, LDraw
  and CSV emission) MUST have automated tests. Golden fixtures derived from the reference
  PowerShell scripts MUST be committed and run in CI.
- Any change that alters solver output for existing inputs MUST update the golden fixtures
  deliberately, with the reason stated in the commit or PR description. Silent fixture updates
  are not allowed.
- Visual rendering quality is assessed by human review of generated surfaces and builds, and
  the outcome MUST be recorded in the feature's spec or tasks.

Rationale: geometry bugs are subtle. Fixtures from scripts that already produced working builds
are the fastest way to catch them.

## Technology, Hosting & Constraints

- **Hosting:** a static site served at `angle.thronebuilder.com`, a subdomain of the
  ThroneBuilder site. GitHub is the source of truth, and the deployment pipeline from GitHub is
  the only path to production. Manual edits on the host are not allowed.
- **Language:** TypeScript with `strict: true`. `any` MUST NOT appear without an inline comment
  explaining why it is unavoidable.
- **Dependencies:** prefer the platform and small, mature libraries (for example, an established
  WebGL library for the 3D view). Each new dependency MUST be justified by a concrete need in the
  plan.
- **Environment:** development targets a Windows 11 workstation with Smart App Control enabled.
  Tooling MUST NOT require disabling OS security controls.
- **Accessibility:** core controls (surface selection, angle list, filters, downloads) MUST be
  keyboard-operable and labeled. The angle list MUST be a full alternative to the protractor
  graphic.
- **Non-goals until adopted by amendment or spec:** user accounts, saved cloud projects,
  BrickLink ordering or live pricing, angles outside 0°–90°, more than two surfaces in a single
  solution, and automatic build-size optimization.

## Development Workflow & Quality Gates

- Every feature follows the Spec Kit lifecycle: specify → clarify → plan → tasks → implement,
  on a dedicated feature branch.
- Every `/speckit-plan` MUST include a Constitution Check against Principles I–VI. Any deviation
  MUST be justified in the plan's Complexity Tracking table.
- **Merge gates:** solver golden-fixture tests pass; unit conversion tests pass; exported LDraw
  parses; CSV and LDraw part counts agree; the feature has been checked in a real browser.
- **Open questions** (for example, the edge offset for walls, choosing or simplifying
  wall-on-wall mirror solutions, and preferred build size of 4–6 binding points) MUST be
  resolved through calculation, comparison against the reference scripts, or physical
  prototypes, and the decision MUST be recorded in the relevant spec.

## Governance

This constitution takes precedence over other project practices. Feature specs, plans, and
tasks MUST be checked against it.

- **Amendments:** made by editing this file through `/speckit-constitution`. Each amendment MUST
  include a documented reason, a Sync Impact Report, a version bump, and the project owner's
  approval.
- **Versioning:** MAJOR for removing, redefining, or weakening a principle; MINOR for adding a
  principle or section or materially expanding guidance; PATCH for clarifications and wording.
- **Compliance review:** compliance is checked at every spec and plan, and at each merge gate.
  If a practice conflicts with this constitution, the constitution governs.
- **Runtime guidance:** `initial-spec.md` is the detailed product reference. Where it conflicts
  with this constitution, this constitution governs until either document is amended.

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
