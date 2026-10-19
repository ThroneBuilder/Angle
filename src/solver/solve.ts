import type { AngleSolution, AngleTenths, SolverInput } from '../types.ts';
import { solveAngleCentered } from './centered.ts';
import { tierIndexFor } from './constants.ts';
import { prepare, type Prepared } from './match.ts';
import { solveAngleShifted } from './shifted.ts';

/** Every stored solution for one angle: one for centered, one per distinct placement for shifted. */
export function solveAngle(input: SolverInput, k: AngleTenths, prepared?: Prepared): AngleSolution[] {
  if (input.placement === 'shifted') return solveAngleShifted(input, k, prepared);
  const s = solveAngleCentered(input, k, prepared);
  return s ? [s] : [];
}

/** Solve angles fromK…toK (inclusive). Synchronous; the worker calls it in chunks. */
export function solveRange(input: SolverInput, fromK: AngleTenths, toK: AngleTenths, prepared?: Prepared): AngleSolution[] {
  const p = prepared ?? prepare(input);
  const out: AngleSolution[] = [];
  for (let k = fromK; k <= toK; k++) out.push(...solveAngle(input, k, p));
  return out;
}

/** The solution shown at a tolerance: the one whose tier covers it. */
export function pickForTolerance(solutions: readonly AngleSolution[], toleranceLbu: number): AngleSolution | null {
  const bit = 1 << tierIndexFor(toleranceLbu);
  return solutions.find((s) => (s.tierMask & bit) !== 0) ?? null;
}
