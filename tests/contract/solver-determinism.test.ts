import { describe, expect, it } from 'vitest';
import { toSolverInput } from '../../src/solver/grid.ts';
import { pack, unpack } from '../../src/solver/packing.ts';
import { solveRange } from '../../src/solver/solve.ts';
import { PRESETS, PRESET_IDS } from '../../src/surfaces/presets.ts';
import type { PlacementMode, SolveResult } from '../../src/types.ts';

describe.each(PRESET_IDS)('preset %s', (id) => {
  describe.each(['centered', 'shifted'] as PlacementMode[])('%s', (placement) => {
    const config = { ...PRESETS[id].config, placement };
    const input = toSolverInput(config);
    const first = solveRange(input, 1, 899);

    it('gives identical results on every run', () => {
      expect(solveRange(input, 1, 899)).toEqual(first);
    }, 60_000);

    it('returns angles in order, at most one solution per angle and tier, none empty', () => {
      for (let n = 1; n < first.length; n++) expect(first[n]!.angle).toBeGreaterThanOrEqual(first[n - 1]!.angle);
      const byAngle = new Map<number, number>();
      for (const s of first) {
        const seen = byAngle.get(s.angle) ?? 0;
        expect(seen & s.tierMask).toBe(0);
        byAngle.set(s.angle, seen | s.tierMask);
      }
      expect(first.every((s) => s.connections.length > 0 && s.tierMask > 0)).toBe(true);
    });

    it('survives packing for transfer between threads', () => {
      const result: SolveResult = { config, solutions: first, complete: true };
      expect(unpack(pack(result))).toEqual(result);
    });
  });
});
