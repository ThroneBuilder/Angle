// The single Build model behind the drawings, the 3D view, LDraw, and the parts list (T047;
// FR-021, Constitution V).
import { COLORS } from '../catalog/candidates.ts';
import { colorFor, isCurrent, part as catalogPart } from '../catalog/catalog.ts';
import type { FilteredAngle } from '../solver/filter.ts';
import { toSolverInput } from '../solver/grid.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { Build, BuildOptions, BuiltSurface, Catalog, ColorRef, Configuration, FilterSettings, PlacedPart } from '../types.ts';
import { connectorAt, overlapWarnings } from './connectors.ts';
import { layoutSurface } from './layout.ts';
import { offsetParts } from './offsets.ts';
import { trimSurface } from './trim.ts';

export interface BuildRequest {
  readonly solution: FilteredAngle;
  readonly buildDeg: number;
  readonly config: Configuration;
  readonly filters: FilterSettings;
  readonly options: BuildOptions;
  readonly catalog: Catalog;
}

/** Local coordinates (LBU from the built surface's first binding point) of a grid index. */
export function localPoint(surface: BuiltSurface, steps: { stepX: number; stepY: number }, i: number, j: number) {
  return { x: (i - surface.offsetI) * steps.stepX, y: (j - surface.offsetJ) * steps.stepY };
}

export function makeBuild(req: BuildRequest): Build {
  const { solution, config, catalog } = req;
  const input = toSolverInput(config);
  const warnings: string[] = [];
  const connections = solution.kept;

  const trim = req.options.trimToConnections;
  const bottom: BuiltSurface = trim
    ? trimSurface(config.bottom, connections.map((c) => c.bottom), input.bottom, warnings)
    : { spec: config.bottom, offsetI: 0, offsetJ: 0 };
  const top: BuiltSurface = trim
    ? trimSurface(config.top, connections.map((c) => c.top), input.top, warnings)
    : { spec: config.top, offsetI: 0, offsetJ: 0 };

  const recolor = (p: PlacedPart, preferred: ColorRef): PlacedPart => ({ ...p, color: colorFor(catalog, p.part, preferred) });
  const bottomParts = layoutSurface(bottom.spec, COLORS.bottom, warnings).map((p) => recolor(p, COLORS.bottom));
  const topParts = layoutSurface(top.spec, COLORS.top, warnings).map((p) => recolor(p, COLORS.top));
  const connectors = connections.map((c) => {
    const b = localPoint(bottom, input.bottom, c.bottom.i, c.bottom.j);
    const t = localPoint(top, input.top, c.top.i, c.top.j);
    bottomParts.push(...offsetParts(bottom.spec.typeId, b.x, b.y, COLORS.offset).map((p) => recolor(p, COLORS.offset)));
    topParts.push(...offsetParts(top.spec.typeId, t.x, t.y, COLORS.offset).map((p) => recolor(p, COLORS.offset)));
    const connector = connectorAt(bottom.spec.typeId, c, b.x, b.y, COLORS.connector);
    // Risers make fractional positions, so they share the adjustment color; pins stay black.
    const preferred = connector.placed.kind === 'riser' ? COLORS.offset : COLORS.connector;
    return { ...connector, placed: recolor(connector.placed, preferred) };
  });
  warnings.push(...overlapWarnings(connectors));
  if ([bottom, top].some((s) => SURFACE_TYPES[s.spec.typeId].offsetRule === 'technic1x1')) {
    warnings.push('Offset parts on Technic surfaces are approximate until checked with a physical prototype.');
  }

  // Every part and color must be currently produced (FR-022).
  const all = [...bottomParts, ...topParts, ...connectors.map((c) => c.placed)];
  for (const p of new Set(all.map((p) => `${p.part}/${p.color}`))) {
    const [no, colorId] = p.split('/') as [string, string];
    if (!catalogPart(catalog, no)) warnings.push(`Part ${no} is not in the catalog of current parts.`);
    else if (!isCurrent(catalog, no, Number(colorId))) warnings.push(`Part ${no} is not currently produced in color ${colorId}.`);
  }

  return {
    config,
    filters: req.filters,
    options: req.options,
    angle: solution.solution.angle,
    buildDeg: req.buildDeg,
    placement: solution.solution.placement,
    connections,
    bottom,
    top,
    bottomParts,
    topParts,
    connectors,
    catalogVersion: catalog.version,
    warnings: [...new Set(warnings)],
  };
}
