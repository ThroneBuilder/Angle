// Golden fixtures from the reference scripts (SC-001, Constitution I and VI).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyFilters, qualifyingAngles } from '../../src/solver/filter.ts';
import { toSolverInput } from '../../src/solver/grid.ts';
import { groupSolutions } from '../../src/solver/group.ts';
import { pickForTolerance, solveAngle, solveRange } from '../../src/solver/solve.ts';
import type { FilterSettings, GridSpec, SolverInput } from '../../src/types.ts';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')) as T;
}

interface DoubleAngles {
  grid: { stepX: number; sizeX: number; stepY: number; sizeY: number };
  toleranceLbu: number;
  angles: { k: number; pairs: [number, number, number, number][] }[];
}

interface TripleTable {
  bottomStepLbu: { x: number; y: number };
  rows: { angle: number; dxLbu: number; dyLbu: number; lengthLbu: number }[];
}

/**
 * Boundary-only differences from the reference script, each justified. The script requires
 * |dx| < tol and |dy| < tol before testing distance <= tol, and uses .NET Math.Cos/Sin; the
 * solver tests only distance <= tol with the committed trig table. Add an entry only with a reason.
 */
const KNOWN_DIFFERENCES: { k: number; reason: string }[] = [];

const key = (p: readonly number[]) => p.join(',');

describe('DoubleAngles.ps1 (centered, tolerance 0.4)', () => {
  const fixture = load<DoubleAngles>('double-angles.json');
  // Ad-hoc grid with the script's steps, independent of the product's surface types.
  const grid: GridSpec = { dimensions: 2, ...fixture.grid };
  const input: SolverInput = { top: grid, bottom: grid, placement: 'centered' };
  const filters: FilterSettings = { toleranceLbu: fixture.toleranceLbu, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: false };
  const expected = new Map(fixture.angles.map((a) => [a.k, a.pairs.map(key).sort()]));
  const known = new Set(KNOWN_DIFFERENCES.map((d) => d.k));

  it('matches every angle from 0.1° to 89.9°', () => {
    const mismatches: number[] = [];
    for (let k = 1; k <= 899; k++) {
      if (known.has(k)) continue;
      const solution = pickForTolerance(solveAngle(input, k), filters.toleranceLbu);
      const kept = solution ? applyFilters(solution, filters, input).kept : [];
      const actual = kept.map((c) => key([c.top.i, c.top.j, c.bottom.i, c.bottom.j])).sort();
      const want = expected.get(k) ?? [];
      if (actual.join(';') !== want.join(';')) mismatches.push(k);
    }
    expect(mismatches).toEqual([]);
  });
});

describe('PythagoreanTriples.ps1 whole-step run (owner verified)', () => {
  // Whole studs x whole bricks, $tolerance = 0.05 (0.5 LBU of length), angles from the owner's run.
  const SCRIPT_ANGLES = [23.6, 31.0, 36.9, 45.8, 67.4, 79.5, 85.2, 90.0];

  it('builds exactly the script angles (plus the trivial 0° build) with 0.25 LBU per pin', () => {
    const config = {
      top: { typeId: 'liftarm' as const, sizeX: 140 },
      bottom: { typeId: 'technicWall' as const, sizeX: 150, sizeY: 132, stepX: 10, stepY: 12 },
      placement: 'shifted' as const,
    };
    const input = toSolverInput(config);
    const filters: FilterSettings = { toleranceLbu: 0.25, minConnections: 2, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: false };
    const qualifying = qualifyingAngles({ config, solutions: solveRange(input, 1, 899), complete: true }, filters, input);
    const built = groupSolutions(qualifying, input).map((g) => Number(g.buildDeg.toFixed(1)));
    expect(built).toEqual([0, ...SCRIPT_ANGLES]);
  }, 30_000);
});

describe.each([
  ['PythagoreanTriples.ps1', 'pythagorean.json'],
  ['FloorAngles.ps1', 'floor-angles.json'],
])('%s (shifted, tolerance 0.5)', (_source, file) => {
  const fixture = load<TripleTable>(file);
  const rows = fixture.rows.filter((r) => r.angle > 0.05 && r.angle < 89.95);

  it.each(rows.map((r) => [r.angle, r]))('finds at least 2 connections at %s°', (_angle, row) => {
    const top: GridSpec = { dimensions: 1, stepX: 10, stepY: 10, sizeX: row.lengthLbu, sizeY: 0 };
    const bottom: GridSpec = {
      dimensions: 2,
      stepX: fixture.bottomStepLbu.x,
      stepY: fixture.bottomStepLbu.y,
      sizeX: fixture.bottomStepLbu.x * 16,
      sizeY: fixture.bottomStepLbu.y * 16,
    };
    const input: SolverInput = { top, bottom, placement: 'shifted' };
    const k = Math.round(row.angle * 10);
    const solution = pickForTolerance(solveAngle(input, k), 0.5);
    expect(solution).not.toBeNull();
    const { kept } = applyFilters(solution!, { toleranceLbu: 0.5, minConnections: 2, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: false }, input);
    expect(kept.length).toBeGreaterThanOrEqual(2);
  });
});
