import { describe, expect, it } from 'vitest';
import { applyFilters, qualifyingAngles } from '../../src/solver/filter.ts';
import type { AngleSolution, Connection, FilterSettings, SolverInput } from '../../src/types.ts';

const input2d: SolverInput = {
  top: { dimensions: 2, stepX: 5, stepY: 5, sizeX: 50, sizeY: 50 },
  bottom: { dimensions: 2, stepX: 5, stepY: 5, sizeX: 50, sizeY: 50 },
  placement: 'centered',
};
const input1d: SolverInput = { ...input2d, top: { dimensions: 1, stepX: 10, stepY: 10, sizeX: 50, sizeY: 0 } };

function conn(bi: number, bj: number, errorLbu = 0): Connection {
  return { top: { i: bi, j: bj }, bottom: { i: bi, j: bj }, errorLbu };
}

function solution(connections: Connection[], angle = 100): AngleSolution {
  return {
    angle,
    tierMask: 0b1111,
    placement: { offsetX: 0, offsetY: 0 },
    connections,
    worstErrorLbu: Math.max(...connections.map((c) => c.errorLbu)),
  };
}

const loose: FilterSettings = { toleranceLbu: 1, minConnections: 0, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0 };

describe('applyFilters', () => {
  it('drops connections above the tolerance first', () => {
    const s = solution([conn(0, 0, 0), conn(1, 0, 0.3), conn(2, 1, 0.6), conn(3, 3, 0.9)]);
    expect(applyFilters(s, { ...loose, toleranceLbu: 0.5 }, input2d).kept).toHaveLength(2);
    expect(applyFilters(s, { ...loose, toleranceLbu: 1 }, input2d).kept).toHaveLength(4);
  });

  it('keeps only zero-error connections at tolerance 0', () => {
    const s = solution([conn(0, 0, 0), conn(1, 0, 0.0001), conn(2, 2, 0)]);
    expect(applyFilters(s, { ...loose, toleranceLbu: 0 }, input2d).kept).toHaveLength(2);
  });

  it('applies the minimum spacing to area tops too, row by row', () => {
    // Top points 5 LBU apart along a row, min spacing 1 stud (10 LBU): keep 0, drop 1, keep 2, drop 3, keep 4.
    const s = solution([0, 1, 2, 3, 4].map((i) => conn(i, 0)));
    const { kept } = applyFilters(s, { ...loose, minSpacing: 1 }, input2d);
    expect(kept.map((c) => c.top.i)).toEqual([0, 2, 4]);
  });

  it('does not qualify collinear connections on an area top, whatever their number', () => {
    const s = solution([0, 1, 2, 3, 4, 5, 6].map((i) => conn(i, i)));
    expect(applyFilters(s, loose, input2d).qualifies).toBe(false);
  });

  it('qualifies a linear top with 2 connections and an area top with 3 off-line', () => {
    expect(applyFilters(solution([conn(0, 0), conn(4, 0)]), loose, input1d).qualifies).toBe(true);
    expect(applyFilters(solution([conn(0, 0), conn(4, 0)]), loose, input2d).qualifies).toBe(false);
    expect(applyFilters(solution([conn(0, 0), conn(4, 0), conn(2, 3)]), loose, input2d).qualifies).toBe(true);
  });

  it('raises the minimum to the structural minimum', () => {
    expect(applyFilters(solution([conn(0, 0)]), { ...loose, minConnections: 1 }, input1d).qualifies).toBe(false);
  });

  it('reports the worst error among kept connections', () => {
    const s = solution([conn(0, 0, 0.1), conn(1, 2, 0.4), conn(3, 0, 0.8)]);
    expect(applyFilters(s, { ...loose, toleranceLbu: 0.5 }, input2d).shownWorstErrorLbu).toBe(0.4);
  });
});

describe('spacing', () => {
  // input1d: liftarm-like top, hole step 10 LBU. conn(i, ...) connects top hole i.
  const holes = (...is: number[]) => solution(is.map((i) => conn(i, 0)));

  it('reports the smallest spacing and the span in LBU', () => {
    const f = applyFilters(holes(0, 2, 5), loose, input1d);
    expect(f.spacingLbu).toBe(20);
    expect(f.spanLbu).toBe(50);
  });

  it('drops holes closer than the minimum spacing, walking in hole order', () => {
    // Holes 0,1,2,4 with min spacing 2: keep 0, drop 1, keep 2, keep 4.
    const f = applyFilters(holes(0, 1, 2, 4), { ...loose, minSpacing: 2 }, input1d);
    expect(f.kept.map((c) => c.top.i).sort((a, b) => a - b)).toEqual([0, 2, 4]);
    expect(f.spacingLbu).toBe(20);
  });

  it('qualifies only when the smallest spacing is within the maximum', () => {
    expect(applyFilters(holes(0, 6), { ...loose, maxSpacing: 5, maxWorstErrorLbu: 0 }, input1d).qualifies).toBe(false);
    expect(applyFilters(holes(0, 6), { ...loose, maxSpacing: 6, maxWorstErrorLbu: 0 }, input1d).qualifies).toBe(true);
    expect(applyFilters(holes(0, 6), { ...loose, maxSpacing: 0, maxWorstErrorLbu: 0 }, input1d).qualifies).toBe(true);
  });

  it('uses the smallest distance between any two points on an area top', () => {
    // Top points (0, 0), (20, 0), (10, 15) LBU: spacing √325 ≈ 18.03, span 20.
    const s = solution([conn(0, 0), conn(4, 0), conn(2, 3)]);
    const f = applyFilters(s, loose, input2d);
    expect(f.spacingLbu).toBeCloseTo(Math.sqrt(325), 9);
    expect(f.spanLbu).toBe(20);
    expect(applyFilters(s, { ...loose, maxSpacing: 1, maxWorstErrorLbu: 0 }, input2d).qualifies).toBe(false);
    expect(applyFilters(s, { ...loose, maxSpacing: 2, maxWorstErrorLbu: 0 }, input2d).qualifies).toBe(true);
  });
});

describe('maximum worst error', () => {
  it('hides solutions whose worst kept error is above it, and 0 shows all', () => {
    const s = solution([conn(0, 0, 0.05), conn(4, 0, 0.18), conn(2, 3, 0.1)]);
    expect(applyFilters(s, { ...loose, maxWorstErrorLbu: 0.15 }, input2d).qualifies).toBe(false);
    expect(applyFilters(s, { ...loose, maxWorstErrorLbu: 0.2 }, input2d).qualifies).toBe(true);
    expect(applyFilters(s, { ...loose, maxWorstErrorLbu: 0 }, input2d).qualifies).toBe(true);
  });
});

describe('qualifyingAngles', () => {
  it('returns only qualifying angles, in angle order', () => {
    const solutions = [
      solution([conn(0, 0), conn(4, 0), conn(2, 3)], 10),
      solution([conn(0, 0), conn(4, 0)], 20),
      solution([conn(0, 0), conn(4, 0), conn(2, 3), conn(5, 5)], 30),
    ];
    const result = { config: {} as never, solutions, complete: true };
    expect(qualifyingAngles(result, loose, input2d).map((q) => q.solution.angle)).toEqual([10, 30]);
  });
});
