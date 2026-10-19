import { describe, expect, it } from 'vitest';
import { SOLVE_TOLERANCE_LBU, TIERS_LBU } from '../../src/solver/constants.ts';
import { solveAngleCentered } from '../../src/solver/centered.ts';
import { matchPrepared, prepare, within } from '../../src/solver/match.ts';
import { toSolverInput } from '../../src/solver/grid.ts';
import { solveAngleShifted, solveAngleShiftedTier } from '../../src/solver/shifted.ts';
import type { GridSpec, SolverInput } from '../../src/types.ts';

describe('solveAngleShifted', () => {
  it('finds a half-step offset that centered placement misses', () => {
    // A 145 LBU bottom puts its points on odd multiples of 2.5, so a centered liftarm at 90°
    // misses every point; shifting by (2.5, 2.5) lands all 15 holes exactly.
    const input: SolverInput = {
      top: { dimensions: 1, stepX: 10, stepY: 10, sizeX: 140, sizeY: 0 },
      bottom: { dimensions: 2, stepX: 5, stepY: 5, sizeX: 145, sizeY: 145 },
      placement: 'shifted',
    };
    expect(solveAngleCentered(input, 900)).toBeNull();
    const all = solveAngleShifted(input, 900);
    expect(all).toHaveLength(1);
    const s = all[0]!;
    expect(s.tierMask).toBe(0b1111);
    expect(s.connections).toHaveLength(15);
    expect(s.placement.offsetX).toBeCloseTo(2.5, 6);
    expect(s.placement.offsetY).toBeCloseTo(2.5, 6);
    expect(s.worstErrorLbu).toBeLessThan(1e-6);
  });

  it('prefers the tight 3-4-5 solution over a loose cluster with as many connections', () => {
    // A 100 LBU liftarm on a 10 x 12 grid at 36.9°: both ends land within 0.05 LBU at offset
    // (0, 6) mod the grid. A loose pair near 1.0 LBU must not win.
    const input: SolverInput = {
      top: { dimensions: 1, stepX: 10, stepY: 10, sizeX: 100, sizeY: 0 },
      bottom: { dimensions: 2, stepX: 10, stepY: 12, sizeX: 160, sizeY: 192 },
      placement: 'shifted',
    };
    for (let t = 0; t < TIERS_LBU.length; t++) {
      const s = solveAngleShiftedTier(input, 369, t)!;
      expect(within(s.connections, 0.1).count).toBeGreaterThanOrEqual(2);
    }
  });

  it('never finds fewer connections than centered placement, at every tier', () => {
    for (const typeId of ['plate', 'hybridWall'] as const) {
      const config = {
        top: { typeId: 'liftarm' as const, sizeX: 140 },
        bottom: { typeId, sizeX: 150, sizeY: typeId === 'plate' ? 150 : 108 },
      };
      const shifted = toSolverInput({ ...config, placement: 'shifted' });
      const centered = toSolverInput({ ...config, placement: 'centered' });
      for (let k = 7; k <= 899; k += 31) {
        const c = solveAngleCentered(centered, k);
        TIERS_LBU.forEach((tol, t) => {
          const s = solveAngleShiftedTier(shifted, k, t);
          const sc = s ? within(s.connections, tol).count : 0;
          const cc = c ? within(c.connections, tol).count : 0;
          expect(sc).toBeGreaterThanOrEqual(cc);
        });
      }
    }
  });

  it('keeps every stored error within the solve tolerance', () => {
    const input = toSolverInput({
      top: { typeId: 'plate', sizeX: 60, sizeY: 60 },
      bottom: { typeId: 'plate', sizeX: 150, sizeY: 150 },
      placement: 'shifted',
    });
    for (let k = 11; k <= 899; k += 97) {
      for (const s of solveAngleShifted(input, k)) {
        expect(s.connections.every((c) => c.errorLbu <= SOLVE_TOLERANCE_LBU)).toBe(true);
      }
    }
  });

  it('matches an exhaustive offset search on small surfaces', () => {
    // Exhaustive search: every offset on a 0.05 LBU grid, at tiers 0.5 and 1.0.
    const top: GridSpec = { dimensions: 2, stepX: 5, stepY: 5, sizeX: 30, sizeY: 30 };
    const bottom: GridSpec = { dimensions: 2, stepX: 5, stepY: 4, sizeX: 60, sizeY: 60 };
    const input: SolverInput = { top, bottom, placement: 'shifted' };
    const prepared = prepare(input);
    for (const k of [37, 211, 389, 563, 701]) {
      const best = [0, 0];
      // Offsets beyond ±15 push part of the 30 LBU top off the 60 LBU bottom.
      for (let a = -300; a <= 300; a++) {
        for (let b = -300; b <= 300; b++) {
          const m = matchPrepared(prepared, k, a * 0.05, b * 0.05);
          best[0] = Math.max(best[0]!, within(m, 0.5).count);
          best[1] = Math.max(best[1]!, within(m, 1.0).count);
        }
      }
      const at05 = solveAngleShiftedTier(input, k, 1);
      const at10 = solveAngleShiftedTier(input, k, 3);
      expect(at05 ? within(at05.connections, 0.5).count : 0).toBeGreaterThanOrEqual(best[0]!);
      expect(at10 ? within(at10.connections, 1.0).count : 0).toBeGreaterThanOrEqual(best[1]!);
    }
  }, 120_000);
});
