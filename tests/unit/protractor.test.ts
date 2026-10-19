import { describe, expect, it } from 'vitest';
import { nearestPoint, polarPoints } from '../../src/render/protractor-svg.ts';
import type { FilteredAngle } from '../../src/solver/filter.ts';
import type { SolutionGroup } from '../../src/solver/group.ts';

function group(buildDeg: number, spacingLbu: number, worst = 0): SolutionGroup {
  const best: FilteredAngle = {
    solution: { angle: 100, tierMask: 15, placement: { offsetX: 0, offsetY: 0 }, connections: [], worstErrorLbu: worst },
    kept: [],
    qualifies: true,
    shownWorstErrorLbu: worst,
    spacingLbu,
    spanLbu: spacingLbu,
  };
  return { buildDeg, from: 100, to: 100, best, members: [best] };
}

describe('polarPoints', () => {
  it('places each solution at its build angle, with the measure as the radius', () => {
    const { points, rMax } = polarPoints([group(0, 40), group(90, 80)], 'spacing', 0.25, 100);
    expect(rMax).toBe(8);
    expect(points[0]).toMatchObject({ value: 4 });
    expect(points[0]!.x).toBeCloseTo(50);
    expect(points[0]!.y).toBeCloseTo(0);
    expect(points[1]!.x).toBeCloseTo(0);
    expect(points[1]!.y).toBeCloseTo(-100);
  });

  it('colors by worst error in the same bands as the match map', () => {
    const { points } = polarPoints([group(30, 20, 0), group(60, 20, 0.25)], 'spacing', 0.25, 100);
    expect(points.map((p) => p.band)).toEqual([0, 4]);
  });
});

describe('nearestPoint', () => {
  it('picks the closest point within reach, or none', () => {
    const { points } = polarPoints([group(0, 40), group(45, 40)], 'spacing', 0.25, 100);
    expect(nearestPoint(points, 98, 2, 12)?.group.buildDeg).toBe(0);
    expect(nearestPoint(points, 50, 50, 12)).toBeNull();
  });
});
