// SolveResult <-> typed arrays for transfer between the worker and the page (research R15).
import type { AngleSolution, Configuration, Connection, SolveResult } from '../types.ts';

export interface PackedSolveResult {
  readonly config: Configuration;
  readonly complete: boolean;
  readonly angles: Int16Array;
  readonly tierMasks: Uint8Array;
  readonly offsetX: Float64Array;
  readonly offsetY: Float64Array;
  readonly worst: Float32Array;
  /** Connection range of angle n is starts[n] … starts[n + 1]. */
  readonly starts: Uint32Array;
  /** (topI, topJ, bottomI, bottomJ) per connection. */
  readonly indices: Int16Array;
  readonly errors: Float32Array;
}

export function pack(result: SolveResult): PackedSolveResult {
  const { solutions } = result;
  const total = solutions.reduce((sum, s) => sum + s.connections.length, 0);
  const angles = new Int16Array(solutions.length);
  const tierMasks = new Uint8Array(solutions.length);
  const offsetX = new Float64Array(solutions.length);
  const offsetY = new Float64Array(solutions.length);
  const worst = new Float32Array(solutions.length);
  const starts = new Uint32Array(solutions.length + 1);
  const indices = new Int16Array(total * 4);
  const errors = new Float32Array(total);
  let c = 0;
  solutions.forEach((s, n) => {
    angles[n] = s.angle;
    tierMasks[n] = s.tierMask;
    offsetX[n] = s.placement.offsetX;
    offsetY[n] = s.placement.offsetY;
    worst[n] = s.worstErrorLbu;
    starts[n] = c;
    for (const conn of s.connections) {
      indices.set([conn.top.i, conn.top.j, conn.bottom.i, conn.bottom.j], c * 4);
      errors[c] = conn.errorLbu;
      c++;
    }
  });
  starts[solutions.length] = c;
  return { config: result.config, complete: result.complete, angles, tierMasks, offsetX, offsetY, worst, starts, indices, errors };
}

export function unpack(packed: PackedSolveResult): SolveResult {
  const solutions: AngleSolution[] = [];
  for (let n = 0; n < packed.angles.length; n++) {
    const connections: Connection[] = [];
    for (let c = packed.starts[n]!; c < packed.starts[n + 1]!; c++) {
      const q = c * 4;
      connections.push({
        top: { i: packed.indices[q]!, j: packed.indices[q + 1]! },
        bottom: { i: packed.indices[q + 2]!, j: packed.indices[q + 3]! },
        errorLbu: packed.errors[c]!,
      });
    }
    solutions.push({
      angle: packed.angles[n]!,
      tierMask: packed.tierMasks[n]!,
      placement: { offsetX: packed.offsetX[n]!, offsetY: packed.offsetY[n]! },
      connections,
      worstErrorLbu: packed.worst[n]!,
    });
  }
  return { config: packed.config, solutions, complete: packed.complete };
}

export function transferables(packed: PackedSolveResult): ArrayBuffer[] {
  return [packed.angles, packed.tierMasks, packed.offsetX, packed.offsetY, packed.worst, packed.starts, packed.indices, packed.errors].map(
    (a) => a.buffer as ArrayBuffer,
  );
}
