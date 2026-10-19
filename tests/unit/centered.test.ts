import { describe, expect, it } from 'vitest';
import { SOLVE_TOLERANCE_LBU } from '../../src/solver/constants.ts';
import { solveAngleCentered } from '../../src/solver/centered.ts';
import { toSolverInput } from '../../src/solver/grid.ts';
import type { Connection } from '../../src/types.ts';

const plateOnPlate = toSolverInput({
  top: { typeId: 'plate', sizeX: 150, sizeY: 150 },
  bottom: { typeId: 'plate', sizeX: 150, sizeY: 150 },
  placement: 'centered',
});

function isSortedByBottom(connections: readonly Connection[]): boolean {
  for (let n = 1; n < connections.length; n++) {
    const a = connections[n - 1]!.bottom;
    const b = connections[n]!.bottom;
    if (a.j > b.j || (a.j === b.j && a.i >= b.i)) return false;
  }
  return true;
}

describe('solveAngleCentered', () => {
  it('matches every point of identical plates at 0°', () => {
    const s = solveAngleCentered(plateOnPlate, 0)!;
    expect(s.connections).toHaveLength(961);
    expect(s.worstErrorLbu).toBe(0);
    expect(s.placement).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('matches every point of square plates at 90°', () => {
    const s = solveAngleCentered(plateOnPlate, 900)!;
    expect(s.connections).toHaveLength(961);
    expect(s.worstErrorLbu).toBe(0);
  });

  it('finds connections for a liftarm on a plate near 36.9° (3-4-5)', () => {
    const input = toSolverInput({
      top: { typeId: 'liftarm', sizeX: 140 },
      bottom: { typeId: 'plate', sizeX: 150, sizeY: 150 },
      placement: 'centered',
    });
    const s = solveAngleCentered(input, 369)!;
    expect(s.connections.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps every error within the solve tolerance, sorted by bottom (j, i)', () => {
    for (const k of [1, 123, 450, 777, 899]) {
      const s = solveAngleCentered(plateOnPlate, k);
      if (!s) continue;
      expect(s.connections.every((c) => c.errorLbu <= SOLVE_TOLERANCE_LBU)).toBe(true);
      expect(isSortedByBottom(s.connections)).toBe(true);
      expect(s.worstErrorLbu).toBe(Math.max(...s.connections.map((c) => c.errorLbu)));
    }
  });
});
