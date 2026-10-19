// Surface types from the spec's Surfaces table, as data (Constitution II).
// Lengths in LBU: stud-to-stud 10, brick height 12, plate height 4.
// `drawing`, `fractionRules`, and `baseParts` are filled in by User Story 3.
import type { StepChoice, SurfaceType, SurfaceTypeId, UnitCount } from '../types.ts';

const pending = { kind: 'pending' } as const;

const STUD: StepChoice = { lbu: 10, label: 'Stud (10)' };
const HALF_STUD: StepChoice = { lbu: 5, label: 'Half stud (5)' };
const HOLE: StepChoice = { lbu: 10, label: 'Hole (10)' };
const HALF_HOLE: StepChoice = { lbu: 5, label: 'Half hole (5)' };
const BRICK: StepChoice = { lbu: 12, label: 'Brick (12)' };
const PLATE: StepChoice = { lbu: 4, label: 'Plate (4)' };

/** n studs or holes span (n - 1) * 10 between the first and last binding points. */
const studs = (max: number, singular = 'stud', plural = 'studs'): UnitCount => ({
  unitLbu: 10,
  insetLbu: 10,
  singular,
  plural,
  min: 2,
  max,
});

/** n stacked bricks span (n - 1) * 12: half a brick is lost at each edge for the gap span. */
const bricks = (max: number): UnitCount => ({ unitLbu: 12, insetLbu: 12, singular: 'brick', plural: 'bricks', min: 2, max });

/** n plate-Technic-plate layers (20 LBU each) span n * 20 - 12. */
const layers = (max: number): UnitCount => ({ unitLbu: 20, insetLbu: 12, singular: 'layer', plural: 'layers', min: 1, max });

export const SURFACE_TYPES: Readonly<Record<SurfaceTypeId, SurfaceType>> = {
  brick: {
    id: 'brick',
    name: '1x16 Brick',
    dimensions: 1,
    stepX: 10,
    maxX: 150,
    stepChoicesX: [STUD],
    countX: studs(16),
    receiveStepX: 10,
    edgeOffset: 5,
    view: 'top',
    connectorKind: 'stud',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  liftarm: {
    id: 'liftarm',
    name: '1x15 Technic Liftarm',
    dimensions: 1,
    stepX: 10,
    maxX: 140,
    stepChoicesX: [HOLE],
    countX: studs(15, 'hole', 'holes'),
    receiveStepX: 10,
    edgeOffset: 5,
    view: 'side',
    connectorKind: 'hole',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  technic: {
    id: 'technic',
    name: '1x16 Technic Brick',
    dimensions: 1,
    stepX: 5,
    maxX: 150,
    stepChoicesX: [HOLE, HALF_HOLE],
    countX: studs(16),
    receiveStepX: 5,
    edgeOffset: 5,
    view: 'side',
    connectorKind: 'hole',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  plate: {
    id: 'plate',
    name: '16x16 Plate',
    dimensions: 2,
    stepX: 5,
    maxX: 150,
    stepY: 5,
    maxY: 150,
    stepChoicesX: [STUD, HALF_STUD],
    stepChoicesY: [STUD, HALF_STUD],
    countX: studs(16),
    countY: studs(16),
    receiveStepX: 5,
    receiveStepY: 5,
    edgeOffset: 5,
    view: 'top',
    connectorKind: 'stud',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  baseplate: {
    // The spec table says 32x31, but its 310 x 310 maximum fits a 32x32 baseplate (research R8).
    id: 'baseplate',
    name: '32x32 Baseplate',
    dimensions: 2,
    stepX: 5,
    maxX: 310,
    stepY: 5,
    maxY: 310,
    stepChoicesX: [STUD, HALF_STUD],
    stepChoicesY: [STUD, HALF_STUD],
    countX: studs(32),
    countY: studs(32),
    receiveStepX: 5,
    receiveStepY: 5,
    edgeOffset: 5,
    view: 'top',
    connectorKind: 'stud',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  technicWall: {
    id: 'technicWall',
    name: 'Technic Wall (12 x 1x16 Technic)',
    dimensions: 2,
    stepX: 5,
    maxX: 150,
    stepY: 4,
    maxY: 132,
    stepChoicesX: [STUD, HALF_STUD],
    stepChoicesY: [BRICK, PLATE],
    countX: studs(16),
    countY: bricks(12),
    receiveStepX: 5,
    receiveStepY: 4,
    edgeOffset: 6,
    view: 'side',
    connectorKind: 'hole',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
  hybridWall: {
    // Layer heights (n * 20 - 12) are multiples of a plate but not of a brick, so only the
    // plate step applies vertically.
    id: 'hybridWall',
    name: 'Hybrid Wall (6 x Plate-Technic-Plate)',
    dimensions: 2,
    stepX: 5,
    maxX: 150,
    stepY: 4,
    maxY: 108,
    stepChoicesX: [STUD, HALF_STUD],
    stepChoicesY: [PLATE],
    countX: studs(16),
    countY: layers(6),
    receiveStepX: 5,
    receiveStepY: 4,
    edgeOffset: 6,
    view: 'side',
    connectorKind: 'hole',
    drawing: pending,
    fractionRules: [],
    baseParts: [],
  },
};

export const SURFACE_TYPE_IDS = Object.keys(SURFACE_TYPES) as SurfaceTypeId[];

/** LBU span of n units. */
export function sizeForCount(count: UnitCount, n: number): number {
  return n * count.unitLbu - count.insetLbu;
}

/** The size choices offered for a count, smallest first. */
export function sizeChoices(count: UnitCount): { n: number; lbu: number; label: string }[] {
  const out: { n: number; lbu: number; label: string }[] = [];
  for (let n = count.min; n <= count.max; n++) {
    const lbu = sizeForCount(count, n);
    out.push({ n, lbu, label: `${n} ${n === 1 ? count.singular : count.plural} (${lbu} LBU)` });
  }
  return out;
}

/** Drop chosen steps that equal the type's default, so equal designs compare and link equally. */
export function normalizeSpec<T extends { typeId: SurfaceTypeId; sizeX: number; sizeY?: number; stepX?: number; stepY?: number }>(
  spec: T,
): T {
  const type = SURFACE_TYPES[spec.typeId];
  const { stepX, stepY, ...rest } = spec;
  const out: Record<string, unknown> = { ...rest };
  const defaultY = type.stepY ?? type.stepX;
  const customX = stepX !== undefined && stepX !== type.stepX;
  const customY = type.dimensions === 2 && stepY !== undefined && stepY !== defaultY;
  if (customX || customY) {
    out.stepX = stepX ?? type.stepX;
    if (type.dimensions === 2) out.stepY = stepY ?? defaultY;
  }
  return out as T;
}

/** The step in effect for a surface: the chosen one, or the type's default. */
export function effectiveSteps(spec: { typeId: SurfaceTypeId; stepX?: number; stepY?: number }): { stepX: number; stepY: number } {
  const type = SURFACE_TYPES[spec.typeId];
  return {
    stepX: spec.stepX ?? type.stepX,
    stepY: spec.stepY ?? type.stepY ?? type.stepX,
  };
}
