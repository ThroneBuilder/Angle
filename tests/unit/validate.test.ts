import { describe, expect, it } from 'vitest';
import { PRESETS, PRESET_IDS } from '../../src/surfaces/presets.ts';
import { sizeChoices, SURFACE_TYPES } from '../../src/surfaces/surface-types.ts';
import { structuralMinimum, validateConfiguration, validateFilters } from '../../src/surfaces/validate.ts';
import type { Configuration } from '../../src/types.ts';

const base: Configuration = PRESETS.plateOnPlate.config;

describe('validateConfiguration', () => {
  it('accepts every preset', () => {
    for (const id of PRESET_IDS) {
      expect(validateConfiguration(PRESETS[id].config)).toEqual([]);
    }
  });

  it('rejects sizes that are not a positive multiple of the step', () => {
    expect(validateConfiguration({ ...base, top: { typeId: 'plate', sizeX: 152, sizeY: 150 } })).toHaveLength(1);
    expect(validateConfiguration({ ...base, top: { typeId: 'plate', sizeX: 0, sizeY: 150 } })).toHaveLength(1);
  });

  it('rejects sizes above the maximum', () => {
    expect(validateConfiguration({ ...base, bottom: { typeId: 'plate', sizeX: 155, sizeY: 150 } })).toHaveLength(1);
  });

  it('requires a height on 2D surfaces', () => {
    expect(validateConfiguration({ ...base, bottom: { typeId: 'plate', sizeX: 150 } })).toHaveLength(1);
  });

  it('accepts the step choices of each surface and rejects others', () => {
    const wall = { typeId: 'technicWall' as const, sizeX: 150, sizeY: 132 };
    expect(validateConfiguration({ ...base, bottom: { ...wall, stepX: 10, stepY: 12 } })).toEqual([]);
    expect(validateConfiguration({ ...base, bottom: { ...wall, stepX: 5, stepY: 4 } })).toEqual([]);
    expect(validateConfiguration({ ...base, bottom: { ...wall, stepX: 10, stepY: 5 } })).toHaveLength(1);
    // A hybrid wall's layer heights are plates, not bricks.
    expect(validateConfiguration({ ...base, bottom: { typeId: 'hybridWall', sizeX: 150, sizeY: 108, stepX: 5, stepY: 12 } })).toHaveLength(1);
  });

  it('offers size choices that are multiples of every step choice', () => {
    for (const type of Object.values(SURFACE_TYPES)) {
      for (const [count, steps] of [[type.countX, type.stepChoicesX], [type.countY, type.stepChoicesY]] as const) {
        if (!count || !steps) continue;
        for (const size of sizeChoices(count)) {
          for (const step of steps) expect(size.lbu % step.lbu, `${type.id} ${size.label} / ${step.lbu}`).toBe(0);
        }
      }
      // The largest choice is the spec's maximum.
      expect(sizeChoices(type.countX).at(-1)!.lbu).toBe(type.maxX);
      if (type.countY) expect(sizeChoices(type.countY).at(-1)!.lbu).toBe(type.maxY);
    }
  });

  it('rejects a 1D bottom surface (FR-004)', () => {
    const errors = validateConfiguration({ ...base, bottom: { typeId: 'liftarm', sizeX: 140 } });
    expect(errors.some((e) => e.includes('2D'))).toBe(true);
  });
});

describe('validateFilters', () => {
  const plate = SURFACE_TYPES.plate;

  it('accepts tolerance from 0 to 1.0', () => {
    expect(validateFilters({ toleranceLbu: 0, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0 }, plate)).toEqual([]);
    expect(validateFilters({ toleranceLbu: 1, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0 }, plate)).toEqual([]);
  });

  it('rejects tolerance outside 0 to 1.0', () => {
    expect(validateFilters({ toleranceLbu: -0.1, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0 }, plate)).toHaveLength(1);
    expect(validateFilters({ toleranceLbu: 1.5, minConnections: 3, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0 }, plate)).toHaveLength(1);
  });

  it('rejects a minimum below the structural minimum and a negative spacing', () => {
    expect(validateFilters({ toleranceLbu: 0.5, minConnections: 2, minSpacing: -1, maxSpacing: 0, maxWorstErrorLbu: 0 }, plate)).toHaveLength(2);
  });
});

describe('structuralMinimum', () => {
  it('is 2 for linear tops and 3 for area tops', () => {
    expect(structuralMinimum(SURFACE_TYPES.liftarm)).toBe(2);
    expect(structuralMinimum(SURFACE_TYPES.plate)).toBe(3);
  });
});
