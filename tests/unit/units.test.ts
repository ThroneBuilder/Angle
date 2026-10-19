import { describe, expect, it } from 'vitest';
import { formatAngle, ldrawY, lbuToLdu, tenthsToDegrees } from '../../src/geometry/units.ts';

describe('units', () => {
  it('converts LBU to LDU exactly', () => {
    for (const v of [0, 5, 10, 12, 150, 310]) {
      expect(lbuToLdu(v)).toBe(v * 2);
      expect(Number.isInteger(lbuToLdu(v))).toBe(true);
    }
  });

  it('turns heights into negative LDraw Y', () => {
    expect(ldrawY(12)).toBe(-24);
    expect(ldrawY(4)).toBe(-8);
    expect(ldrawY(0)).toBe(0);
  });

  it('formats angles from tenths', () => {
    expect(tenthsToDegrees(183)).toBe(18.3);
    expect(formatAngle(183)).toBe('18.3°');
    expect(formatAngle(5)).toBe('0.5°');
    expect(formatAngle(900)).toBe('90.0°');
  });
});
