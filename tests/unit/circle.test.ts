import { describe, expect, it } from 'vitest';
import { minEnclosingCircle } from '../../src/geometry/circle.ts';

describe('minEnclosingCircle', () => {
  it('returns radius 0 for one point', () => {
    expect(minEnclosingCircle([{ x: 2, y: 3 }])).toEqual({ x: 2, y: 3, r: 0 });
  });

  it('uses the diameter for two points', () => {
    const c = minEnclosingCircle([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(c.x).toBeCloseTo(2);
    expect(c.y).toBeCloseTo(0);
    expect(c.r).toBeCloseTo(2);
  });

  it('passes through three points on a circle', () => {
    const c = minEnclosingCircle([{ x: 1, y: 0 }, { x: -0.5, y: Math.sqrt(3) / 2 }, { x: -0.5, y: -Math.sqrt(3) / 2 }]);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.r).toBeCloseTo(1);
  });

  it('ignores points inside the hull', () => {
    const c = minEnclosingCircle([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0.2 }, { x: 0.1, y: -0.3 }]);
    expect(c.x).toBeCloseTo(0);
    expect(c.r).toBeCloseTo(1);
  });

  it('gives the same result for any input order', () => {
    const pts = [{ x: 0.3, y: 1.1 }, { x: -2, y: 0.4 }, { x: 1.7, y: -0.9 }, { x: 0.2, y: 2.2 }, { x: -1.1, y: -1.5 }];
    const a = minEnclosingCircle(pts);
    const b = minEnclosingCircle([...pts].reverse());
    const c = minEnclosingCircle([pts[2]!, pts[0]!, pts[4]!, pts[1]!, pts[3]!]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
