// contracts/url-state.md, "Test cases".
import { describe, expect, it } from 'vitest';
import { readState, writeState, type AppLinkState } from '../../src/state/url-state.ts';
import { PRESETS, PRESET_IDS } from '../../src/surfaces/presets.ts';

describe('readState', () => {
  it('opens Brick on plate defaults for an empty link', () => {
    const { state, replaced } = readState('?');
    expect(state.preset).toBe('brickOnPlate');
    expect(state.config).toEqual(PRESETS.brickOnPlate.config);
    expect(state.filters).toEqual(PRESETS.brickOnPlate.filters);
    expect(state.angle).toBeNull();
    expect(state.trim).toBe(false);
    expect(replaced).toEqual([]);
  });

  it('reads a preset and an angle', () => {
    const { state, replaced } = readState('?v=1&preset=plateOnPlate&a=300');
    expect(state.preset).toBe('plateOnPlate');
    expect(state.config).toEqual(PRESETS.plateOnPlate.config);
    expect(state.angle).toBe(300);
    expect(replaced).toEqual([]);
  });

  it('treats a custom link with preset surfaces like the preset (FR-003)', () => {
    const custom = readState('?preset=custom&top=plate:150x150&bottom=plate:150x150').state;
    const preset = readState('?preset=plateOnPlate').state;
    expect(custom.preset).toBe('custom');
    expect(custom.config).toEqual(preset.config);
    expect(custom.filters).toEqual(preset.filters);
  });

  it('replaces a 1D bottom with the preset default and reports it', () => {
    const { state, replaced } = readState('?bottom=liftarm:140');
    expect(state.config.bottom).toEqual(PRESETS.brickOnPlate.config.bottom);
    expect(replaced).toEqual(['bottom']);
  });

  it('replaces invalid tolerance and minimum, and reports both', () => {
    const { state, replaced } = readState('?tol=abc&min=1');
    expect(state.filters.toleranceLbu).toBe(0.25);
    expect(state.filters.minConnections).toBe(2);
    expect(replaced).toEqual(['tol', 'min']);
  });

  it('accepts tolerance 0 and rejects tolerance above 1.0', () => {
    expect(readState('?tol=0')).toMatchObject({ state: { filters: { toleranceLbu: 0 } }, replaced: [] });
    const high = readState('?tol=1.5');
    expect(high.state.filters.toleranceLbu).toBe(0.25);
    expect(high.replaced).toEqual(['tol']);
  });

  it('ignores unknown keys', () => {
    expect(readState('?zzz=1&preset=technicOnWall').replaced).toEqual([]);
  });

  it('becomes custom when surfaces differ from the named preset', () => {
    const { state } = readState('?preset=plateOnPlate&top=plate:100x100');
    expect(state.preset).toBe('custom');
    expect(state.config.top).toEqual({ typeId: 'plate', sizeX: 100, sizeY: 100 });
  });
});

describe('writeState', () => {
  it('round-trips every preset with every option', () => {
    for (const preset of PRESET_IDS) {
      for (const placement of ['centered', 'shifted'] as const) {
        for (const angle of [null, 183]) {
          const state: AppLinkState = {
            preset,
            config: { ...PRESETS[preset].config, placement },
            filters: { ...PRESETS[preset].filters, toleranceLbu: 0.35, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: false },
            trim: angle !== null,
            angle,
          };
          const { state: back, replaced } = readState(writeState(state));
          expect(replaced).toEqual([]);
          expect(back).toEqual(state);
        }
      }
    }
  });

  it('round-trips a custom design', () => {
    const state: AppLinkState = {
      preset: 'custom',
      config: { top: { typeId: 'technic', sizeX: 75 }, bottom: { typeId: 'baseplate', sizeX: 310, sizeY: 200 }, placement: 'shifted' },
      filters: { toleranceLbu: 0, minConnections: 5, minSpacing: 0, maxSpacing: 0, maxWorstErrorLbu: 0, tessellatedOnly: false },
      trim: true,
      angle: 7,
    };
    expect(readState(writeState(state)).state).toEqual(state);
  });

  it('round-trips chosen steps and spacing, and leaves default steps out of the link', () => {
    const state: AppLinkState = {
      preset: 'custom',
      config: {
        top: { typeId: 'liftarm', sizeX: 140 },
        bottom: { typeId: 'technicWall', sizeX: 150, sizeY: 132, stepX: 10, stepY: 12 },
        placement: 'shifted',
      },
      filters: { toleranceLbu: 0.25, minConnections: 2, minSpacing: 4, maxSpacing: 12, maxWorstErrorLbu: 0, tessellatedOnly: false },
      trim: false,
      angle: null,
    };
    const query = writeState(state);
    expect(query).toContain('bottom=technicWall%3A150x132%4010x12');
    expect(query).toContain('top=liftarm%3A140&');
    expect(query).toContain('smin=4&smax=12');
    expect(readState(query)).toEqual({ state, replaced: [] });
  });

  it('treats explicit default steps like no steps', () => {
    const { state } = readState('?preset=custom&top=liftarm:140@10&bottom=technicWall:150x132@5x4');
    expect(state.config.top).toEqual({ typeId: 'liftarm', sizeX: 140 });
    expect(state.config.bottom).toEqual({ typeId: 'technicWall', sizeX: 150, sizeY: 132 });
  });

  it('replaces a step the surface does not offer', () => {
    expect(readState('?preset=custom&top=liftarm:140&bottom=hybridWall:150x108@5x12').replaced).toEqual(['bottom']);
  });

  it('writes keys in a stable order', () => {
    const query = writeState({
      preset: 'hybridOnHybrid',
      config: PRESETS.hybridOnHybrid.config,
      filters: PRESETS.hybridOnHybrid.filters,
      trim: false,
      angle: 183,
    });
    expect(query).toBe('?v=1&preset=hybridOnHybrid&tol=0.25&place=s&min=3&smin=2&smax=0&emax=0&tess=0&trim=0&a=183');
  });
});
