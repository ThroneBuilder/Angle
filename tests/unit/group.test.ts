import { describe, expect, it } from 'vitest';
import type { FilteredAngle } from '../../src/solver/filter.ts';
import { buildAngle, groupOf, groupSolutions } from '../../src/solver/group.ts';
import type { Connection, SolverInput } from '../../src/types.ts';

// A 15-hole liftarm (step 10, centered: hole i at x = 10i - 70) on a 5 x 4 LBU wall.
const input: SolverInput = {
  top: { dimensions: 1, stepX: 10, stepY: 10, sizeX: 140, sizeY: 0 },
  bottom: { dimensions: 2, stepX: 5, stepY: 4, sizeX: 150, sizeY: 132 },
  placement: 'shifted',
};

/** pairs: [topHole, bottomI, bottomJ] */
function angle(k: number, pairs: [number, number, number][], worst = 0.1): FilteredAngle {
  const kept: Connection[] = pairs.map(([t, bi, bj]) => ({ top: { i: t, j: 0 }, bottom: { i: bi, j: bj }, errorLbu: worst }));
  return {
    solution: { angle: k, tierMask: 0b1111, placement: { offsetX: 0, offsetY: 0 }, connections: kept, worstErrorLbu: worst },
    kept,
    qualifies: true,
    shownWorstErrorLbu: worst,
    spacingLbu: null,
    spanLbu: null,
  };
}

describe('buildAngle', () => {
  it('is the direction between the connected bottom points for a linear top', () => {
    // Holes 1 and 14 (130 LBU apart) on bottom points 125 LBU across and 36 LBU up: 16.06°.
    const a = angle(161, [[1, 3, 12], [14, 28, 21]]);
    expect(buildAngle(a, input)).toBeCloseTo((Math.atan2(36, 125) * 180) / Math.PI, 9);
  });

  it('is 0° when every connection lies on one row', () => {
    expect(buildAngle(angle(3, [[0, 2, 5], [12, 26, 5]]), input)).toBe(0);
  });
});

describe('groupSolutions', () => {
  it('merges input angles that build the same angle, even with different holes', () => {
    const groups = groupSolutions(
      [
        angle(1, [[0, 2, 5], [12, 26, 5]]),
        angle(2, [[0, 2, 5], [6, 14, 5]]),
        angle(7, [[3, 8, 9], [5, 12, 9]]),
      ],
      input,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.buildDeg).toBe(0);
    expect(groups[0]!.members).toHaveLength(3);
  });

  it('keeps different build angles apart, in build-angle order', () => {
    const groups = groupSolutions(
      [angle(161, [[1, 3, 12], [14, 28, 21]]), angle(10, [[0, 2, 5], [12, 26, 5]])],
      input,
    );
    expect(groups.map((g) => Number(g.buildDeg.toFixed(2)))).toEqual([0, 16.07]);
  });

  it('shows the member with the most connections, then the smallest error', () => {
    const [g] = groupSolutions(
      [
        angle(1, [[0, 2, 5], [12, 26, 5]], 0.05),
        angle(2, [[0, 2, 5], [6, 14, 5], [12, 26, 5]], 0.2),
        angle(3, [[0, 2, 5], [6, 14, 5], [12, 26, 5]], 0.1),
      ],
      input,
    );
    expect(g!.best.solution.angle).toBe(3);
  });

  it('finds the group containing an input angle', () => {
    const groups = groupSolutions([angle(1, [[0, 2, 5], [12, 26, 5]]), angle(161, [[1, 3, 12], [14, 28, 21]])], input);
    expect(groupOf(groups, 1)?.buildDeg).toBe(0);
    expect(groupOf(groups, 161)?.best.solution.angle).toBe(161);
    expect(groupOf(groups, 200)).toBeNull();
  });
});
