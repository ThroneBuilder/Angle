# Contract: Solver Worker Messages

Implements FR-010, FR-012, and FR-013. The page sends messages to the solver worker, and the
worker sends messages back. The same solver functions are also called directly in tests, without
a worker.

## Page → worker

```ts
type ToWorker =
  | { kind: 'solveAll';   gen: number; config: Configuration; budgetMs: number }
  | { kind: 'solveAngle'; gen: number; config: Configuration; angle: AngleTenths }
  | { kind: 'cancel';     gen: number };
```

`Configuration` has no tolerance. The worker always matches at `SOLVE_TOLERANCE_LBU = 1.0`, and
the page applies the builder's tolerance as a filter (research R15).

## Worker → page

```ts
type FromWorker =
  | { kind: 'progress';   gen: number; done: number; total: number }           // after each chunk
  | { kind: 'result';     gen: number; result: PackedSolveResult }
  | { kind: 'overBudget'; gen: number; estimateMs: number; partial: PackedSolveResult }
  | { kind: 'cancelled';  gen: number }
  | { kind: 'error';      gen: number; message: string };
```

`PackedSolveResult` is the typed-array form from the data model's SolveResult "Transfer format".
Its buffers are sent in the `postMessage` transfer list.

## Rules

- **Chunks and pauses**: `solveAll` solves angles 1…899 in chunks of 10, using the synchronous
  `solveRange(config, fromK, toK)`. After each chunk the worker posts `progress`, then pauses with
  `await new Promise(r => setTimeout(r, 0))`, so a waiting `cancel` message can be handled.
- **Cancel**: when a `cancel` arrives for the running `gen`, the worker stops after the current
  chunk and posts `cancelled`. The page ignores every message whose `gen` is not the latest. If
  no `cancelled` arrives within 200 ms, the page terminates the worker and starts a new one
  (a fallback only).
- **Budget**: after the second chunk (timed alone, so start-up time is excluded), the worker
  estimates the total time. If the estimate is over
  `budgetMs` (10,000), it sends `overBudget` with the angles already solved, and the page offers to
  solve a single angle.
- `result` holds every angle with at least one connection within `SOLVE_TOLERANCE_LBU`, in angle
  order, with one solution per distinct placement (shifted mode stores one per tolerance level,
  merged when equal; see `tierMask` in the data model). Connections within an angle are sorted by bottom `(j, i)`. All filters (tolerance,
  spacing, minimum connections) are applied on the page, never in the worker.
- **Determinism (tested)**: for the same `config`, `solveRange(config, 1, 899)` returns exactly the
  same result (compared with deep equality) in Node and in every browser (research R2). Errors
  are rounded to `Float32` inside the solver, so packing loses nothing.
- Only plain data and transferable buffers cross between threads.
