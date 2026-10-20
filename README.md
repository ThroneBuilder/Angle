# LEGO Angle Designer

A web application for designing LEGO builds that join two surfaces at a specific angle, such as a
brick on a plate, a liftarm against a wall, or one wall on another. It finds every angle from 0.1°
to 89.9° where studs or holes on both surfaces line up within a pin's tolerance, then draws the
build and shows it in 3D.

**Will be live at [angle.thronebuilder.com](https://angle.thronebuilder.com)** · Third in a series
of [ThroneBuilder](https://thronebuilder.com) LEGO projects alongside the
[Faceplate Designer](https://faceplate.thronebuilder.com) (face mosaics) and the
[Mountain Designer](https://mountain.thronebuilder.com) (mountain rendering).

## Features
- **Presets and custom surfaces:** Brick on plate, Plate on plate, Liftarm on wall, and Hybrid wall
  on hybrid wall, or any combination of bricks, liftarms, Technic bricks, plates, baseplates,
  Technic walls, and hybrid walls, with whole or half steps (studs, holes, bricks, plates).
- **Exact angle search:** tests every 0.1°, rotating the top surface about the center and,
  optionally, shifting it so the build can pivot on any connection ("Allow all imperfect").
  Results are identical in every browser.
- **Solutions, not just angles:** input angles that build the same angle are one solution, shown
  at the angle the build actually makes.
- **Filters:** tolerance per pin, minimum connections, minimum and maximum spacing, maximum worst
  error, and "Trim tessellated connections" to keep only a solution's repeating pattern.
- **Protractor and match map:** every solution plotted by angle against spacing, span, or
  connection count, colored by error.
- **Drawings and 3D:** each surface drawn as LEGO parts with connections in red and the parts that
  make half steps, plus a rotatable 3D view. Drawings and views download as PNG or SVG.
- **Current parts only:** builds use parts and colors from a dated snapshot of LEGO sets released
  this year or last ([Rebrickable](https://rebrickable.com/downloads/) data).
- **Shareable links:** the page link saves the whole design.

Units are LEGO Base Units (LBU): studs are 10 LBU apart, a brick is 12 LBU high, and a plate is 4.

## Tech Stack
- **Frontend:** Vite (static site, TypeScript strict, no UI framework)
- **3D:** three.js, loaded only when the 3D view first opens
- **Solver:** runs in a Web Worker, with a committed sine/cosine table for identical results everywhere
- **Hosting:** Render (static site, deployed from GitHub)
- **Testing:** Vitest

## Project Structure
```
src/
  solver/       → Angle search, filters, grouping, tessellation, worker
  surfaces/     → Surface types, presets, validation
  build/        → Parts layout, connectors, offset parts, trimming
  catalog/      → Candidate parts and the dated parts catalog (JSON)
  render/       → Protractor, match map, surface drawings, 3D view
  state/        → Design link (URL) format
  ui/           → Controls, solution list, notices, sections
  geometry/     → Units and trigonometry
scripts/        → Trig table and parts catalog generators
reference/      → Original PowerShell scripts, for checking results only
tests/          → Vitest test suite, including golden fixtures from the reference scripts
specs/          → Feature specification, plan, research, contracts, and tasks
```

## Documentation
- [Constitution](.specify/memory/constitution.md): project principles and quality gates
- [Specification](specs/001-angle-designer/spec.md): what the app does and why
- [Plan](specs/001-angle-designer/plan.md) and [research](specs/001-angle-designer/research.md):
  how it works and the decisions behind it
- [Quickstart](specs/001-angle-designer/quickstart.md): how to run and check each feature

## Development
```powershell
# Install dependencies
pnpm install

# Start the dev server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Rebuild the parts catalog from Rebrickable (network access required)
pnpm catalog
```
