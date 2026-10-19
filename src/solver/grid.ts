import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { BindingPoint, Configuration, GridSpec, SolverInput, SurfaceSpec } from '../types.ts';

/**
 * A surface's binding-point grid. A chosen step wins; otherwise the top uses the receiving step
 * (research R6) and the bottom the type's default step.
 */
export function gridFor(spec: SurfaceSpec, role: 'top' | 'bottom'): GridSpec {
  const type = SURFACE_TYPES[spec.typeId];
  const stepX = spec.stepX ?? (role === 'top' ? type.receiveStepX : type.stepX);
  if (type.dimensions === 1) {
    return { dimensions: 1, stepX, stepY: stepX, sizeX: spec.sizeX, sizeY: 0 };
  }
  const stepY = spec.stepY ?? (role === 'top' ? type.receiveStepY : type.stepY) ?? stepX;
  return { dimensions: 2, stepX, stepY, sizeX: spec.sizeX, sizeY: spec.sizeY ?? 0 };
}

export function toSolverInput(config: Configuration): SolverInput {
  return {
    top: gridFor(config.top, 'top'),
    bottom: gridFor(config.bottom, 'bottom'),
    placement: config.placement,
  };
}

export function columns(grid: GridSpec): number {
  return grid.sizeX / grid.stepX + 1;
}

export function rows(grid: GridSpec): number {
  return grid.dimensions === 1 ? 1 : grid.sizeY / grid.stepY + 1;
}

/** Binding points relative to the surface center, ordered by j then i. */
export function bindingPoints(grid: GridSpec): BindingPoint[] {
  const points: BindingPoint[] = [];
  const nx = columns(grid);
  const ny = rows(grid);
  for (let j = 0; j < ny; j++) {
    const y = grid.dimensions === 1 ? 0 : j * grid.stepY - grid.sizeY / 2;
    for (let i = 0; i < nx; i++) {
      points.push({ i, j, x: i * grid.stepX - grid.sizeX / 2, y });
    }
  }
  return points;
}
