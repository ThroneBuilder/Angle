// Page side of the solver worker (contracts/solver-worker.md).
import type { AngleTenths, Configuration, SolveResult } from '../types.ts';
import { unpack } from './packing.ts';
import type { FromWorker, ToWorker } from './worker.ts';

export const BUDGET_MS = 10_000;
const CANCEL_FALLBACK_MS = 200;

export type SolverUpdate =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'result'; result: SolveResult }
  | { kind: 'overBudget'; estimateMs: number; partial: SolveResult }
  | { kind: 'error'; message: string };

export class SolverClient {
  private worker: Worker;
  private gen = 0;
  private job: ToWorker | null = null;
  private running = false;
  private fallback: ReturnType<typeof setTimeout> | null = null;
  private listener: (update: SolverUpdate) => void = () => {};

  constructor() {
    this.worker = this.createWorker();
  }

  onUpdate(listener: (update: SolverUpdate) => void): void {
    this.listener = listener;
  }

  start(config: Configuration): void {
    this.run({ kind: 'solveAll', gen: this.gen + 1, config, budgetMs: BUDGET_MS });
  }

  startSingle(config: Configuration, angle: AngleTenths): void {
    this.run({ kind: 'solveAngle', gen: this.gen + 1, config, angle });
  }

  /** Stop the current run; its results are ignored from now on. */
  cancel(): void {
    if (!this.running) return;
    const gen = this.gen;
    this.gen++;
    this.running = false;
    this.job = null;
    this.worker.postMessage({ kind: 'cancel', gen } satisfies ToWorker);
    this.armFallback();
  }

  private run(job: ToWorker): void {
    if (this.running) {
      this.worker.postMessage({ kind: 'cancel', gen: this.gen } satisfies ToWorker);
      this.armFallback();
    }
    this.gen = job.gen;
    this.job = job;
    this.running = true;
    this.worker.postMessage(job);
  }

  /** If the worker does not confirm the cancel in time, replace it and resend the current job. */
  private armFallback(): void {
    if (this.fallback) clearTimeout(this.fallback);
    this.fallback = setTimeout(() => {
      this.fallback = null;
      this.worker.terminate();
      this.worker = this.createWorker();
      if (this.job) this.worker.postMessage(this.job);
    }, CANCEL_FALLBACK_MS);
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<FromWorker>) => this.receive(event.data);
    worker.onerror = (event) => this.listener({ kind: 'error', message: event.message || 'The solver stopped unexpectedly.' });
    return worker;
  }

  private receive(msg: FromWorker): void {
    if (msg.kind === 'cancelled') {
      if (this.fallback && msg.gen < this.gen) {
        clearTimeout(this.fallback);
        this.fallback = null;
      }
      return;
    }
    if (msg.gen !== this.gen) return;
    switch (msg.kind) {
      case 'progress':
        this.listener({ kind: 'progress', done: msg.done, total: msg.total });
        break;
      case 'result':
        this.running = false;
        this.listener({ kind: 'result', result: unpack(msg.result) });
        break;
      case 'overBudget':
        this.running = false;
        this.listener({ kind: 'overBudget', estimateMs: msg.estimateMs, partial: unpack(msg.partial) });
        break;
      case 'error':
        this.running = false;
        this.listener({ kind: 'error', message: msg.message });
        break;
    }
  }
}
