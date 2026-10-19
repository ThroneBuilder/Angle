import { DEFAULT_MIN_SPACING, DEFAULT_TOLERANCE_LBU } from '../solver/constants.ts';
import type { Configuration, FilterSettings } from '../types.ts';
import { SURFACE_TYPES } from './surface-types.ts';
import { structuralMinimum } from './validate.ts';

export type PresetId = 'brickOnPlate' | 'plateOnPlate' | 'technicOnWall' | 'hybridOnHybrid';

export interface Preset {
  readonly id: PresetId;
  readonly name: string;
  readonly config: Configuration;
  readonly filters: FilterSettings;
}

function preset(id: PresetId, name: string, config: Configuration): Preset {
  return {
    id,
    name,
    config,
    filters: {
      toleranceLbu: DEFAULT_TOLERANCE_LBU,
      minConnections: structuralMinimum(SURFACE_TYPES[config.top.typeId]),
      minSpacing: DEFAULT_MIN_SPACING,
      maxSpacing: 0,
    },
  };
}

// Linear tops default to shifted placement, so a connection can anchor at any hole, as in the
// owner's builds; area tops default to centered, as in DoubleAngles.ps1.
export const PRESETS: Readonly<Record<PresetId, Preset>> = {
  brickOnPlate: preset('brickOnPlate', 'Brick on plate', {
    top: { typeId: 'brick', sizeX: 150 },
    bottom: { typeId: 'plate', sizeX: 150, sizeY: 150 },
    placement: 'shifted',
  }),
  plateOnPlate: preset('plateOnPlate', 'Plate on plate', {
    top: { typeId: 'plate', sizeX: 150, sizeY: 150 },
    bottom: { typeId: 'plate', sizeX: 150, sizeY: 150 },
    placement: 'centered',
  }),
  technicOnWall: preset('technicOnWall', 'Technic on wall', {
    top: { typeId: 'liftarm', sizeX: 140 },
    bottom: { typeId: 'technicWall', sizeX: 150, sizeY: 132 },
    placement: 'shifted',
  }),
  hybridOnHybrid: preset('hybridOnHybrid', 'Hybrid wall on hybrid wall', {
    top: { typeId: 'hybridWall', sizeX: 150, sizeY: 108 },
    bottom: { typeId: 'hybridWall', sizeX: 150, sizeY: 108 },
    placement: 'centered',
  }),
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const DEFAULT_PRESET: PresetId = 'brickOnPlate';
