// Every part the build may use (research R8), by role. The catalog script keeps only those LEGO
// currently produces; the build reports any that are missing (Constitution IV).
import type { ColorRef, PartRef } from '../types.ts';

export interface LengthPart {
  /** Length in whole units (studs, or holes for liftarms). */
  readonly n: number;
  readonly part: PartRef;
}

/** 1 x N bricks, by stud length. */
export const BRICKS: readonly LengthPart[] = [
  { n: 2, part: '3004' },
  { n: 3, part: '3622' },
  { n: 4, part: '3010' },
  { n: 6, part: '3009' },
  { n: 8, part: '3008' },
  { n: 10, part: '6111' },
  { n: 12, part: '6112' },
  { n: 16, part: '2465' },
];

/** Thick Technic liftarms, by hole count. */
export const LIFTARMS: readonly LengthPart[] = [
  { n: 2, part: '43857' },
  { n: 3, part: '32523' },
  { n: 5, part: '32316' },
  { n: 7, part: '32524' },
  { n: 9, part: '40490' },
  { n: 11, part: '32525' },
  { n: 13, part: '41239' },
  { n: 15, part: '32278' }, // Rebrickable's number for the 1 x 15 thick beam (LDraw 64871 not found)
];

/** 1 x N Technic bricks with holes, by stud length. */
export const TECHNIC_BRICKS: readonly LengthPart[] = [
  { n: 1, part: '6541' },
  { n: 2, part: '3700' },
  { n: 4, part: '3701' },
  { n: 6, part: '3894' },
  { n: 8, part: '3702' },
  { n: 10, part: '2730' },
  { n: 12, part: '3895' },
  { n: 14, part: '32018' },
  { n: 16, part: '3703' },
];

/** 1 x N plates, by stud length. */
export const PLATES_1: readonly LengthPart[] = [
  { n: 1, part: '3024' },
  { n: 2, part: '3023' },
  { n: 3, part: '3623' },
  { n: 4, part: '3710' },
  { n: 6, part: '3666' },
  { n: 8, part: '3460' },
  { n: 10, part: '4477' },
  { n: 12, part: '60479' },
];

/** 2 x N plates, by stud length. */
export const PLATES_2: readonly LengthPart[] = [
  { n: 2, part: '3022' },
  { n: 3, part: '3021' },
  { n: 4, part: '3020' },
  { n: 6, part: '3795' },
  { n: 8, part: '3034' },
  { n: 10, part: '3832' },
  { n: 12, part: '2445' },
  { n: 16, part: '4282' },
];

export const PLATE_16X16: PartRef = '91405';
export const BASEPLATE_32X32: PartRef = '3811';

/** Connectors and offset parts (FR-017, FR-020a). */
export const ROUND_PLATE_1X1: PartRef = '6141'; // Rebrickable's number for round plate 1 x 1 (LDraw 4073)
export const JUMPER_1X2: PartRef = '15573';
export const JUMPER_2X2: PartRef = '87580';
export const TECHNIC_PIN: PartRef = '61332'; // current friction pin; 2780 (center slots) is retired
export const TECHNIC_BRICK_1X1: PartRef = '6541';
export const PLATE_1X1: PartRef = '3024';

/** Default colors (Rebrickable ids, which match LDraw codes for these colors). */
export const COLORS = {
  bottom: 72, // Dark Bluish Gray
  top: 72, // Dark Bluish Gray
  connector: 0, // Black (pins)
  offset: 71, // Light Bluish Gray: fractional adjustments (offset parts and risers)
} as const satisfies Record<string, ColorRef>;

export function allCandidateParts(): PartRef[] {
  const parts = new Set<PartRef>([
    ...[BRICKS, LIFTARMS, TECHNIC_BRICKS, PLATES_1, PLATES_2].flatMap((list) => list.map((p) => p.part)),
    PLATE_16X16,
    BASEPLATE_32X32,
    ROUND_PLATE_1X1,
    JUMPER_1X2,
    JUMPER_2X2,
    TECHNIC_PIN,
    TECHNIC_BRICK_1X1,
    PLATE_1X1,
  ]);
  return [...parts].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
