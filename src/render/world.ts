// Where each surface sits in 3D (T054; FR-018, FR-021). Pure, so it can be tested without a
// browser. Both surfaces share the solver's rotation plane, with the origin at the center of the
// original bottom surface; the top is rotated by the solved angle and moved by the placement
// offset, exactly as the solver placed it, so connectors land within each connection's error.
import { toSolverInput } from '../solver/grid.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { Build, PartKind } from '../types.ts';

export interface PlaneFrame {
  /** Center of the surface's first binding point in the shared plane (before rotation for the top). */
  readonly originX: number;
  readonly originY: number;
  /** Rotation of the surface in the plane, in degrees (0 for the bottom). */
  readonly rotationDeg: number;
  /** Translation applied after rotation (the placement offset for the top; 0 for the bottom). */
  readonly offsetX: number;
  readonly offsetY: number;
}

export function planeFrame(build: Build, which: 'top' | 'bottom'): PlaneFrame {
  const input = toSolverInput(build.config);
  if (which === 'bottom') {
    const g = input.bottom;
    return {
      originX: build.bottom.offsetI * g.stepX - g.sizeX / 2,
      originY: build.bottom.offsetJ * g.stepY - g.sizeY / 2,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
    };
  }
  const g = input.top;
  return {
    originX: build.top.offsetI * g.stepX - g.sizeX / 2,
    originY: g.dimensions === 1 ? 0 : build.top.offsetJ * g.stepY - g.sizeY / 2,
    rotationDeg: build.angle / 10,
    offsetX: build.placement.offsetX,
    offsetY: build.placement.offsetY,
  };
}

/** A surface-local point (LBU from its first binding point) in the shared plane. */
export function toPlane(frame: PlaneFrame, x: number, y: number): { u: number; v: number } {
  const a = (frame.rotationDeg * Math.PI) / 180;
  const px = x + frame.originX;
  const py = y + frame.originY;
  return {
    u: px * Math.cos(a) - py * Math.sin(a) + frame.offsetX,
    v: px * Math.sin(a) + py * Math.cos(a) + frame.offsetY,
  };
}

/** Plane orientation: flat (plates and bricks seen from above) or upright (walls, liftarms). */
export type Orientation = 'flat' | 'upright';

export interface Stack {
  readonly orientation: Orientation;
  /** Extent along the plane's normal [from, to] in LBU for each part kind, per surface. */
  readonly bottom: (kind: PartKind) => readonly [number, number];
  readonly top: (kind: PartKind) => readonly [number, number];
  readonly riser: readonly [number, number];
  readonly pin: readonly [number, number];
}

const THICK: Partial<Record<PartKind, number>> = { plate: 4, baseplate: 2, brick: 12, technic: 12, liftarm: 12 };

/**
 * How the surfaces stack along the plane's normal. Flat: the bottom from 0 up, one-plate risers on
 * it, the top resting on the risers. Upright: two one-stud-thick walls face to face, pins through.
 */
export function stackFor(build: Build): Stack {
  const orientation: Orientation = SURFACE_TYPES[build.bottom.spec.typeId].view === 'top' ? 'flat' : 'upright';
  if (orientation === 'upright') {
    return {
      orientation,
      bottom: (kind) => (kind === 'offset' ? [-10.4, 0.2] : [-10, 0]),
      top: (kind) => (kind === 'offset' ? [-0.2, 10.4] : [0, 10]),
      riser: [0, 4],
      pin: [-10, 10],
    };
  }
  const bottomTop = Math.max(...build.bottomParts.map((p) => THICK[p.kind] ?? 4));
  const topBase = bottomTop + 4;
  return {
    orientation,
    bottom: (kind) => [0, THICK[kind] ?? 4],
    top: (kind) => [topBase, topBase + (THICK[kind] ?? 4)],
    riser: [bottomTop, bottomTop + 4],
    pin: [0, topBase],
  };
}
