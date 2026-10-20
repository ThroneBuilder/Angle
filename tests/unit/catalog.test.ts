import { describe, expect, it } from 'vitest';
import { CATALOG, colorFor, isCurrent, part } from '../../src/catalog/catalog.ts';
import { allCandidateParts } from '../../src/catalog/candidates.ts';
import type { Catalog } from '../../src/types.ts';

const fixture: Catalog = {
  version: 'test',
  snapshotDate: '2026-01-01',
  parts: {
    '3024': { name: 'Plate 1 x 1', ldrawFile: '3024.dat', colors: [0, 71] },
    '2780': { name: 'Technic Pin', ldrawFile: '2780.dat', colors: [0] },
  },
  colors: {
    '0': { name: 'Black', ldrawCode: 0, rgb: '#05131D' },
    '71': { name: 'Light Bluish Gray', ldrawCode: 71, rgb: '#A0A5A9' },
    '72': { name: 'Dark Bluish Gray', ldrawCode: 72, rgb: '#6C6E68' },
  },
};

describe('catalog lookups', () => {
  it('finds parts and current colors', () => {
    expect(part(fixture, '3024')?.name).toBe('Plate 1 x 1');
    expect(part(fixture, '9999')).toBeNull();
    expect(isCurrent(fixture, '3024', 71)).toBe(true);
    expect(isCurrent(fixture, '3024', 72)).toBe(false);
  });

  it('keeps a current preferred color and otherwise falls back by name', () => {
    expect(colorFor(fixture, '3024', 71)).toBe(71);
    expect(colorFor(fixture, '2780', 72)).toBe(0);
    expect(colorFor(fixture, '9999', 72)).toBe(72);
  });
});

describe('the committed snapshot', () => {
  it('has a version, a date, and at least the core parts', () => {
    expect(CATALOG.version).toMatch(/^lego-angle-\d{4}-\d{2}-\d{2}$/);
    for (const no of ['61332', '3703', '3024']) expect(part(CATALOG, no), no).not.toBeNull();
  });

  it('lists only candidate parts', () => {
    const candidates = new Set(allCandidateParts());
    for (const no of Object.keys(CATALOG.parts)) expect(candidates.has(no), no).toBe(true);
  });
});
