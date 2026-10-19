import { describe, expect, it } from 'vitest';
import { COS, SIN } from '../../src/geometry/trig-table.ts';

describe('trig table', () => {
  it('has 901 entries', () => {
    expect(COS).toHaveLength(901);
    expect(SIN).toHaveLength(901);
  });

  it('has exact endpoints', () => {
    expect(COS[0]).toBe(1);
    expect(SIN[0]).toBe(0);
    expect(COS[900]).toBe(0);
    expect(SIN[900]).toBe(1);
  });

  it('matches Math.cos and Math.sin closely', () => {
    for (let k = 0; k <= 900; k++) {
      const r = (k * Math.PI) / 1800;
      expect(Math.abs(COS[k]! - Math.cos(r))).toBeLessThan(1e-15);
      expect(Math.abs(SIN[k]! - Math.sin(r))).toBeLessThan(1e-15);
    }
  });

  it('is exactly symmetric', () => {
    for (let k = 0; k <= 900; k++) {
      expect(COS[k]).toBe(SIN[900 - k]);
    }
  });
});
