import { describe, expect, it } from 'vitest';
import { maxErrorChoices } from '../../src/render/charts.ts';

describe('maxErrorChoices', () => {
  it('offers All and the error band edges below the tolerance, largest first', () => {
    expect(maxErrorChoices(0.25).map((c) => c.value)).toEqual([0, 0.2, 0.15, 0.1, 0.05]);
    expect(maxErrorChoices(0.25)[0]!.label).toBe('All (≤ 0.25)');
  });

  it('offers only All at tolerance 0', () => {
    expect(maxErrorChoices(0)).toHaveLength(1);
  });
});
