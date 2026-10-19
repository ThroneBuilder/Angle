import type { AngleSolution, AngleTenths, SolverInput } from '../types.ts';
import { ALL_TIERS } from './constants.ts';
import { matchPrepared, prepare, toSolution, type Prepared } from './match.ts';

const CENTERED = { offsetX: 0, offsetY: 0 } as const;

/** Rotate the top about the shared center and match without any offset (research R3). */
export function solveAngleCentered(input: SolverInput, k: AngleTenths, prepared?: Prepared): AngleSolution | null {
  const p = prepared ?? prepare(input);
  return toSolution(k, ALL_TIERS, CENTERED, matchPrepared(p, k, 0, 0));
}
