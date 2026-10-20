// T054: in 3D, every connection's top point lands within its stated error of the bottom point
// (FR-018, FR-021), with and without trimming.
import { describe, expect, it } from 'vitest';
import { localPoint, makeBuild } from '../../src/build/build.ts';
import { CATALOG } from '../../src/catalog/catalog.ts';
import { planeFrame, stackFor, toPlane } from '../../src/render/world.ts';
import { qualifyingAngles } from '../../src/solver/filter.ts';
import { toSolverInput } from '../../src/solver/grid.ts';
import { groupSolutions } from '../../src/solver/group.ts';
import { solveRange } from '../../src/solver/solve.ts';
import { PRESETS, PRESET_IDS } from '../../src/surfaces/presets.ts';

describe.each(PRESET_IDS)('%s', (id) => {
  const p = PRESETS[id];
  const input = toSolverInput(p.config);
  const result = { config: p.config, solutions: solveRange(input, 300, 330), complete: true };
  const groups = groupSolutions(qualifyingAngles(result, p.filters, input), input).slice(0, 3);

  it.each([false, true])('places top connections on bottom connections (trim %s)', (trimToConnections) => {
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      const build = makeBuild({ solution: g.best, buildDeg: g.buildDeg, config: p.config, filters: p.filters, options: { trimToConnections }, catalog: CATALOG });
      const bottom = planeFrame(build, 'bottom');
      const top = planeFrame(build, 'top');
      for (const c of build.connections) {
        const b = localPoint(build.bottom, input.bottom, c.bottom.i, c.bottom.j);
        const t = localPoint(build.top, input.top, c.top.i, c.top.j);
        const pb = toPlane(bottom, b.x, b.y);
        const pt = toPlane(top, t.x, t.y);
        expect(Math.abs(Math.hypot(pb.u - pt.u, pb.v - pt.v) - c.errorLbu)).toBeLessThan(1e-4);
      }
    }
  }, 30_000);

  it('stacks the top above the bottom', () => {
    const g = groups[0]!;
    const build = makeBuild({ solution: g.best, buildDeg: g.buildDeg, config: p.config, filters: p.filters, options: { trimToConnections: false }, catalog: CATALOG });
    const stack = stackFor(build);
    const kind = build.topParts[0]!.kind;
    expect(stack.top(kind)[0]).toBeGreaterThanOrEqual(stack.bottom(build.bottomParts[0]!.kind)[1]);
    expect(stack.orientation).toBe(id === 'plateOnPlate' || id === 'brickOnPlate' ? 'flat' : 'upright');
  });
});
