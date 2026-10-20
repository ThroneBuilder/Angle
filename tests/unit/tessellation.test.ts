import { describe, expect, it } from 'vitest';
import { applyFilters } from '../../src/solver/filter.ts';
import { findTessellation } from '../../src/solver/tessellation.ts';
import type { AngleSolution, Connection, SolverInput } from '../../src/types.ts';

const conn = (bi: number, bj: number, ti: number, tj: number): Connection => ({
  top: { i: ti, j: tj },
  bottom: { i: bi, j: bj },
  errorLbu: 0.1,
});

/** A 3 x 3 grid: steps (2, 1 | 2, -1) and (-1, 2 | 1, 2) between bottom and top indices. */
function grid(): Connection[] {
  const out: Connection[] = [];
  for (let m = 0; m < 3; m++) for (let n = 0; n < 3; n++) out.push(conn(10 + 2 * m - n, 10 + m + 2 * n, 10 + 2 * m + n, 10 - m + 2 * n));
  return out;
}

describe('findTessellation', () => {
  it('keeps the repeating grid and drops one-off connections', () => {
    const outliers = [conn(3, 1, 7, 2), conn(25, 4, 1, 9)];
    const t = findTessellation([...outliers, ...grid()])!;
    expect(t.members).toHaveLength(9);
    expect(t.members.some((c) => outliers.includes(c))).toBe(false);
    expect(t.basis).toHaveLength(2);
  });

  it('finds a row with one step vector', () => {
    const row = [0, 1, 2, 3].map((m) => conn(5 + 3 * m, 5, 5 + 3 * m, 5));
    const t = findTessellation([...row, conn(1, 9, 4, 4)])!;
    expect(t.members).toHaveLength(4);
    expect(t.basis).toHaveLength(1);
  });

  it('finds nothing when no step repeats', () => {
    expect(findTessellation([conn(0, 0, 0, 0), conn(3, 1, 2, 5), conn(7, 9, 1, 1)])).toBeNull();
  });

  it('gives the same result for any input order', () => {
    const all = [conn(3, 1, 7, 2), ...grid(), conn(25, 4, 1, 9)];
    const a = findTessellation(all)!.members.map((c) => JSON.stringify(c)).sort();
    const b = findTessellation([...all].reverse())!.members.map((c) => JSON.stringify(c)).sort();
    expect(b).toEqual(a);
  });
});

describe('Trim tessellated connections filter', () => {
  const input: SolverInput = {
    top: { dimensions: 2, stepX: 5, stepY: 5, sizeX: 150, sizeY: 150 },
    bottom: { dimensions: 2, stepX: 5, stepY: 5, sizeX: 150, sizeY: 150 },
    placement: 'shifted',
  };
  const solution = (connections: Connection[]): AngleSolution => ({
    angle: 100,
    tierMask: 15,
    placement: { offsetX: 0, offsetY: 0 },
    connections,
    worstErrorLbu: 0.1,
  });
  const filters = { toleranceLbu: 0.25, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: true };

  it('keeps only the pattern when on, and everything when off', () => {
    const s = solution([conn(3, 1, 7, 2), ...grid()]);
    expect(applyFilters(s, filters, input).kept).toHaveLength(9);
    expect(applyFilters(s, { ...filters, tessellatedOnly: false }, input).kept).toHaveLength(10);
  });

  it('drops a solution with no repeating pattern', () => {
    const s = solution([conn(0, 0, 0, 0), conn(3, 1, 2, 5), conn(7, 9, 1, 1)]);
    expect(applyFilters(s, filters, input).qualifies).toBe(false);
  });
});
