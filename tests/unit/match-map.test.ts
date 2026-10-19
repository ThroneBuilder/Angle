import { describe, expect, it } from 'vitest';
import { errorBand, matchMapPoints, niceMax } from '../../src/render/match-map.ts';
import type { FilteredAngle } from '../../src/solver/filter.ts';
import type { SolutionGroup } from '../../src/solver/group.ts';

function group(buildDeg: number, links: number, worst: number, spacingLbu: number | null, spanLbu: number | null): SolutionGroup {
  const best: FilteredAngle = {
    solution: { angle: Math.round(buildDeg * 10) || 1, tierMask: 15, placement: { offsetX: 0, offsetY: 0 }, connections: [], worstErrorLbu: worst },
    kept: Array.from({ length: links }, (_, i) => ({ top: { i, j: 0 }, bottom: { i, j: 0 }, errorLbu: worst })),
    qualifies: true,
    shownWorstErrorLbu: worst,
    spacingLbu,
    spanLbu,
  };
  return { buildDeg, from: best.solution.angle, to: best.solution.angle, best, members: [best] };
}

const plot = { width: 900, height: 140 };

describe('matchMapPoints', () => {
  const groups = [group(0, 3, 0, 10, 140), group(45, 2, 0.1, 70, 70), group(90, 4, 0.25, 20, 60)];

  it('places one point per solution, angle across and spacing up', () => {
    const { points, yMax } = matchMapPoints(groups, 'spacing', 0.25, plot);
    expect(points).toHaveLength(3);
    expect(yMax).toBe(8);
    expect(points.map((p) => p.x)).toEqual([0, 450, 900]);
    expect(points[0]!.y).toBeCloseTo(140 - (1 / 8) * 140);
    expect(points[1]!.value).toBe(7);
  });

  it('plots span or connections when asked', () => {
    expect(matchMapPoints(groups, 'span', 0.25, plot).points.map((p) => p.value)).toEqual([14, 7, 6]);
    expect(matchMapPoints(groups, 'connections', 0.25, plot).points.map((p) => p.value)).toEqual([3, 2, 4]);
  });

  it('keeps solutions in build-angle order', () => {
    const { points } = matchMapPoints([groups[2]!, groups[0]!, groups[1]!], 'connections', 0.25, plot);
    expect(points.map((p) => p.group.buildDeg)).toEqual([0, 45, 90]);
  });
});

describe('errorBand', () => {
  it('splits 0…tolerance into 5 equal bands, smallest error first', () => {
    expect(errorBand(0, 0.25)).toBe(0);
    expect(errorBand(0.049, 0.25)).toBe(0);
    expect(errorBand(0.05, 0.25)).toBe(1);
    expect(errorBand(0.25, 0.25)).toBe(4);
    expect(errorBand(0, 0)).toBe(0);
  });
});

describe('niceMax', () => {
  it('rounds up to a clean axis maximum', () => {
    expect(niceMax(7)).toBe(8);
    expect(niceMax(14)).toBe(15);
    expect(niceMax(37)).toBe(40);
    expect(niceMax(0)).toBe(1);
  });
});
