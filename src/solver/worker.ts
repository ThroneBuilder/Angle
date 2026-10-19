// Solver worker (contracts/solver-worker.md). Solves in chunks of 10 angles and pauses between
// chunks, so a `cancel` message can be handled (research R7).
import type { AngleTenths, Configuration, SolveResult } from '../types.ts';
import { FIRST_ANGLE, LAST_ANGLE } from './constants.ts';
import { toSolverInput } from './grid.ts';
import { prepare } from './match.ts';
import { pack, transferables, type PackedSolveResult } from './packing.ts';
import { solveAngle, solveRange } from './solve.ts';

export type ToWorker =
  | { kind: 'solveAll'; gen: number; config: Configuration; budgetMs: number }
  | { kind: 'solveAngle'; gen: number; config: Configuration; angle: AngleTenths }
  | { kind: 'cancel'; gen: number };

export type FromWorker =
  | { kind: 'progress'; gen: number; done: number; total: number }
  | { kind: 'result'; gen: number; result: PackedSolveResult }
  | { kind: 'overBudget'; gen: number; estimateMs: number; partial: PackedSolveResult }
  | { kind: 'cancelled'; gen: number }
  | { kind: 'error'; gen: number; message: string };

const CHUNK = 10;
const ctx = self as unknown as DedicatedWorkerGlobalScope;

let active = -1;
const cancelled = new Set<number>();

function post(message: FromWorker, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}

function postPacked(kind: 'result', gen: number, result: SolveResult): void {
  const packed = pack(result);
  post({ kind, gen, result: packed }, transferables(packed));
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function solveAll(gen: number, config: Configuration, budgetMs: number): Promise<void> {
  active = gen;
  const input = toSolverInput(config);
  const prepared = prepare(input);
  const total = LAST_ANGLE - FIRST_ANGLE + 1;
  const solutions: SolveResult['solutions'][number][] = [];
  let timedFrom = 0;
  let timedAngles = 0;
  for (let from = FIRST_ANGLE; from <= LAST_ANGLE; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, LAST_ANGLE);
    const start = performance.now();
    solutions.push(...solveRange(input, from, to, prepared));
    const done = to - FIRST_ANGLE + 1;
    // Estimate from the second chunk on, so start-up (JIT) time doesn't count.
    if (from > FIRST_ANGLE) {
      timedFrom += performance.now() - start;
      timedAngles += to - from + 1;
    }
    if (from === FIRST_ANGLE + CHUNK) {
      const estimateMs = (timedFrom / timedAngles) * total;
      if (estimateMs > budgetMs) {
        const partial = pack({ config, solutions, complete: false });
        post({ kind: 'overBudget', gen, estimateMs, partial }, transferables(partial));
        return;
      }
    }
    post({ kind: 'progress', gen, done, total });
    await pause();
    if (cancelled.has(gen) || active !== gen) {
      cancelled.delete(gen);
      post({ kind: 'cancelled', gen });
      return;
    }
  }
  postPacked('result', gen, { config, solutions, complete: true });
}

ctx.onmessage = (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  try {
    if (msg.kind === 'cancel') {
      cancelled.add(msg.gen);
    } else if (msg.kind === 'solveAngle') {
      active = msg.gen;
      const solutions = solveAngle(toSolverInput(msg.config), msg.angle);
      postPacked('result', msg.gen, { config: msg.config, solutions, complete: false });
    } else {
      void solveAll(msg.gen, msg.config, msg.budgetMs).catch((e: unknown) =>
        post({ kind: 'error', gen: msg.gen, message: String(e) }),
      );
    }
  } catch (e) {
    post({ kind: 'error', gen: msg.gen, message: String(e) });
  }
};
