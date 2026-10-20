// Base parts for each surface (T045), in the surface's own coordinates: the origin is the first
// binding point, which is a stud center (5 LBU in from the edge), x across, y up.
import {
  BASEPLATE_32X32,
  BRICKS,
  LIFTARMS,
  PLATE_16X16,
  PLATES_1,
  PLATES_2,
  TECHNIC_BRICKS,
  type LengthPart,
} from '../catalog/candidates.ts';
import { SURFACE_TYPES } from '../surfaces/surface-types.ts';
import type { ColorRef, PartKind, PlacedPart, SurfaceSpec } from '../types.ts';

/** Fewest parts whose lengths add up to exactly n, longest first; null if impossible. */
export function tile(lengths: readonly LengthPart[], n: number): LengthPart[] | null {
  const best: (LengthPart[] | null)[] = [[]];
  for (let k = 1; k <= n; k++) {
    let pick: LengthPart[] | null = null;
    for (const p of lengths) {
      const rest = k - p.n >= 0 ? best[k - p.n] : null;
      if (rest && (!pick || rest.length + 1 < pick.length)) pick = [...rest, p];
    }
    best[k] = pick;
  }
  const result = best[n] ?? null;
  return result && [...result].sort((a, b) => b.n - a.n);
}

/** Whole units across a surface: studs or holes. */
export function studsAcross(spec: SurfaceSpec): number {
  return spec.sizeX / 10 + 1;
}

interface Row {
  readonly y: number;
  readonly z: number;
  readonly heightLbu: number;
  readonly depthStuds: 1 | 2;
  readonly kind: PartKind;
  readonly lengths: readonly LengthPart[];
}

function row(r: Row, studs: number, color: ColorRef, warnings: string[]): PlacedPart[] {
  const parts = tile(r.lengths, studs);
  if (!parts) {
    warnings.push(`No combination of parts makes a row ${studs} studs long.`);
    return [];
  }
  const out: PlacedPart[] = [];
  let start = 0;
  for (const p of parts) {
    out.push({
      part: p.part,
      kind: r.kind,
      x: (start + (p.n - 1) / 2) * 10,
      y: r.y,
      z: r.z,
      widthLbu: p.n * 10,
      heightLbu: r.heightLbu,
      rotationDeg: 0,
      color,
    });
    start += p.n;
  }
  return out;
}

export function layoutSurface(spec: SurfaceSpec, color: ColorRef, warnings: string[]): PlacedPart[] {
  const type = SURFACE_TYPES[spec.typeId];
  const nx = studsAcross(spec);
  const sizeY = spec.sizeY ?? 0;
  switch (type.layout) {
    case 'brickRow':
      return row({ y: 0, z: 0, heightLbu: 10, depthStuds: 1, kind: 'brick', lengths: BRICKS }, nx, color, warnings);
    case 'technicRow':
      return row({ y: 0, z: 0, heightLbu: 12, depthStuds: 1, kind: 'technic', lengths: TECHNIC_BRICKS }, nx, color, warnings);
    case 'liftarm': {
      const arm = LIFTARMS.find((l) => l.n >= nx);
      if (!arm) {
        warnings.push(`No liftarm has ${nx} holes.`);
        return [];
      }
      if (arm.n > nx) warnings.push(`No ${nx}-hole liftarm exists; using ${arm.n} holes.`);
      return [{ part: arm.part, kind: 'liftarm', x: ((arm.n - 1) / 2) * 10, y: 0, z: 0, widthLbu: arm.n * 10, heightLbu: 10, rotationDeg: 0, color }];
    }
    case 'plate': {
      const ny = sizeY / 10 + 1;
      if (nx === 16 && ny === 16) {
        return [{ part: PLATE_16X16, kind: 'plate', x: 75, y: 75, z: 0, widthLbu: 160, heightLbu: 160, rotationDeg: 0, color }];
      }
      // Rows of 2 x N plates, and one row of 1 x N plates if the depth is odd.
      const out: PlacedPart[] = [];
      let r = 0;
      for (; r + 1 < ny; r += 2) {
        out.push(...row({ y: (r + 0.5) * 10, z: 0, heightLbu: 20, depthStuds: 2, kind: 'plate', lengths: PLATES_2 }, nx, color, warnings));
      }
      if (r < ny) out.push(...row({ y: r * 10, z: 0, heightLbu: 10, depthStuds: 1, kind: 'plate', lengths: PLATES_1 }, nx, color, warnings));
      return out;
    }
    case 'baseplate':
      if (nx !== 32 || sizeY !== 310) warnings.push('Baseplates come only as 32 x 32; the full baseplate is used.');
      return [{ part: BASEPLATE_32X32, kind: 'baseplate', x: 155, y: 155, z: 0, widthLbu: 320, heightLbu: 320, rotationDeg: 0, color }];
    case 'technicWall': {
      const rows = sizeY / 12 + 1;
      const out: PlacedPart[] = [];
      for (let k = 0; k < rows; k++) {
        out.push(...row({ y: 12 * k, z: 0, heightLbu: 12, depthStuds: 1, kind: 'technic', lengths: TECHNIC_BRICKS }, nx, color, warnings));
      }
      return out;
    }
    case 'hybridWall': {
      // Each 20 LBU layer: plate (4), Technic brick (12), plate (4). The first binding point is 6
      // above the bottom edge, so layer k spans y = 20k - 6 … 20k + 14.
      const layers = (sizeY + 12) / 20;
      const out: PlacedPart[] = [];
      for (let k = 0; k < layers; k++) {
        const base = 20 * k - 6;
        out.push(...row({ y: base + 2, z: 0, heightLbu: 4, depthStuds: 1, kind: 'plate', lengths: PLATES_1 }, nx, color, warnings));
        out.push(...row({ y: base + 10, z: 0, heightLbu: 12, depthStuds: 1, kind: 'technic', lengths: TECHNIC_BRICKS }, nx, color, warnings));
        out.push(...row({ y: base + 18, z: 0, heightLbu: 4, depthStuds: 1, kind: 'plate', lengths: PLATES_1 }, nx, color, warnings));
      }
      return out;
    }
  }
}
