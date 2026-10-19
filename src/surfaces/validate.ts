import { SOLVE_TOLERANCE_LBU } from '../solver/constants.ts';
import type { Configuration, FilterSettings, SurfaceSpec, SurfaceType } from '../types.ts';
import { effectiveSteps, SURFACE_TYPES } from './surface-types.ts';

/** Fewest connections that fix the angle: 2 for a linear top, 3 off-line for an area top (FR-011a). */
export function structuralMinimum(top: SurfaceType): number {
  return top.dimensions === 1 ? 2 : 3;
}

function isPositiveMultiple(value: number, step: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value / step);
}

function validateSurface(label: string, spec: SurfaceSpec): string[] {
  const type = SURFACE_TYPES[spec.typeId];
  if (!type) return [`${label}: unknown surface type "${String(spec.typeId)}".`];
  const errors: string[] = [];
  const { stepX, stepY } = effectiveSteps(spec);
  if (!type.stepChoicesX.some((c) => c.lbu === stepX)) {
    errors.push(`${label} width step must be one of ${type.stepChoicesX.map((c) => c.lbu).join(', ')} LBU.`);
  } else if (!isPositiveMultiple(spec.sizeX, stepX)) {
    errors.push(`${label} width must be a positive multiple of ${stepX} LBU.`);
  } else if (spec.sizeX > type.maxX) {
    errors.push(`${label} width must be at most ${type.maxX} LBU.`);
  }
  if (type.dimensions === 1 && spec.stepY !== undefined) {
    errors.push(`${label} has no height step.`);
  }
  if (type.dimensions === 2) {
    const maxY = type.maxY ?? type.maxX;
    if (!(type.stepChoicesY ?? []).some((c) => c.lbu === stepY)) {
      errors.push(`${label} height step must be one of ${(type.stepChoicesY ?? []).map((c) => c.lbu).join(', ')} LBU.`);
      return errors;
    }
    if (spec.sizeY === undefined) {
      errors.push(`${label} needs a height.`);
    } else if (!isPositiveMultiple(spec.sizeY, stepY)) {
      errors.push(`${label} height must be a positive multiple of ${stepY} LBU.`);
    } else if (spec.sizeY > maxY) {
      errors.push(`${label} height must be at most ${maxY} LBU.`);
    }
  }
  return errors;
}

export function validateConfiguration(c: Configuration): string[] {
  const errors = [...validateSurface('Top surface', c.top), ...validateSurface('Bottom surface', c.bottom)];
  const bottom = SURFACE_TYPES[c.bottom.typeId];
  if (bottom && bottom.dimensions !== 2) {
    errors.push('The bottom surface must be an area (2D) surface.');
  }
  if (c.placement !== 'centered' && c.placement !== 'shifted') {
    errors.push('Placement must be centered or shifted.');
  }
  return errors;
}

export function validateFilters(f: FilterSettings, top: SurfaceType): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(f.toleranceLbu) || f.toleranceLbu < 0 || f.toleranceLbu > SOLVE_TOLERANCE_LBU) {
    errors.push(`Tolerance must be between 0 and ${SOLVE_TOLERANCE_LBU} LBU.`);
  }
  if (!Number.isInteger(f.minConnections) || f.minConnections < structuralMinimum(top)) {
    errors.push(`Minimum connections must be a whole number of at least ${structuralMinimum(top)}.`);
  }
  if (!Number.isFinite(f.minSpacing) || f.minSpacing < 0) {
    errors.push('Minimum spacing must be 0 or more.');
  }
  if (!Number.isFinite(f.maxSpacing) || f.maxSpacing < 0) {
    errors.push('Maximum spacing must be 0 (no limit) or more.');
  } else if (f.maxSpacing > 0 && f.minSpacing > f.maxSpacing) {
    errors.push('Maximum spacing must be at least the minimum spacing.');
  }
  if (!Number.isFinite(f.maxWorstErrorLbu) || f.maxWorstErrorLbu < 0) {
    errors.push('Maximum worst error must be 0 (show all) or more.');
  }
  return errors;
}
