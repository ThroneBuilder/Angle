/**
 * Every match within this distance is stored with its error; the builder's tolerance (0 to this
 * value) is a filter applied afterwards (research R15). Must stay below half the smallest step
 * (4 / 2 = 2 LBU) so rounding to the nearest bottom point finds the only candidate.
 */
export const SOLVE_TOLERANCE_LBU = 1.0;

/**
 * Default filter tolerance per pin. 0.25 LBU per pin matches the owner's physically verified
 * builds, which allowed 0.5 LBU of liftarm length error on one pin.
 */
export const DEFAULT_TOLERANCE_LBU = 0.25;

/** Default minimum spacing between connected points, in top units (holes or studs). */
export const DEFAULT_MIN_SPACING = 2;

/**
 * Shifted placement is optimized separately at each of these tolerances (research R15). The
 * filter shows the placement for the smallest tier at or above the builder's tolerance.
 * Centered placement does not depend on tolerance, so it serves every tier.
 */
export const TIERS_LBU: readonly number[] = [0.25, 0.5, 0.75, 1.0];
export const ALL_TIERS = (1 << TIERS_LBU.length) - 1;

export function tierIndexFor(toleranceLbu: number): number {
  const t = TIERS_LBU.findIndex((tier) => tier >= toleranceLbu);
  return t < 0 ? TIERS_LBU.length - 1 : t;
}

/** Angles tested: 0.1° to 89.9° in tenths of a degree. */
export const FIRST_ANGLE = 1;
export const LAST_ANGLE = 899;
