// The only place lengths and angles change units (Constitution I).
// LBU: stud-to-stud distance (brick width) = 10, brick height = 12, plate height = 4.
// LDraw LDU is half the size, so 1 LBU = 2 LDU exactly.
import type { AngleTenths } from '../types.ts';

export function lbuToLdu(lbu: number): number {
  return lbu * 2;
}

/** LDraw's Y axis points down, so a height above the base becomes negative Y. */
export function ldrawY(heightLbu: number): number {
  return heightLbu === 0 ? 0 : -heightLbu * 2;
}

export function tenthsToDegrees(k: AngleTenths): number {
  return k / 10;
}

export function formatAngle(k: AngleTenths): string {
  return `${Math.floor(k / 10)}.${k % 10}°`;
}

/** Pixels per LBU for 2D drawings. */
export function lbuToPx(lbu: number, scale: number): number {
  return lbu * scale;
}
