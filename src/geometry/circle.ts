// Smallest enclosing circle (Welzl, iterative). The input is sorted, then shuffled with a fixed
// seed: the result never depends on the order points arrive in (research R4, FR-012), and the
// shuffle keeps the expected running time linear.

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

const EPS = 1e-9;

function contains(c: Circle, p: Pt): boolean {
  return Math.hypot(p.x - c.x, p.y - c.y) <= c.r + EPS;
}

function fromTwo(a: Pt, b: Pt): Circle {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  return { x, y, r: Math.hypot(a.x - x, a.y - y) };
}

function fromThree(a: Pt, b: Pt, c: Pt): Circle {
  const bx = b.x - a.x;
  const by = b.y - a.y;
  const cx = c.x - a.x;
  const cy = c.y - a.y;
  const d = 2 * (bx * cy - by * cx);
  if (Math.abs(d) < EPS) {
    // Collinear: the widest pair encloses all three.
    const candidates = [fromTwo(a, b), fromTwo(a, c), fromTwo(b, c)];
    return candidates.reduce((best, k) => (k.r > best.r ? k : best));
  }
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d;
  const uy = (bx * c2 - cx * b2) / d;
  return { x: a.x + ux, y: a.y + uy, r: Math.hypot(ux, uy) };
}

function seededShuffle<T>(items: T[]): T[] {
  let seed = 0x2545f491;
  for (let i = items.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

export function minEnclosingCircle(points: readonly Pt[]): Circle {
  const p = seededShuffle([...points].sort((a, b) => a.x - b.x || a.y - b.y));
  const first = p[0];
  if (!first) return { x: 0, y: 0, r: 0 };
  let c: Circle = { x: first.x, y: first.y, r: 0 };
  for (let i = 1; i < p.length; i++) {
    const pi = p[i]!;
    if (contains(c, pi)) continue;
    c = { x: pi.x, y: pi.y, r: 0 };
    for (let j = 0; j < i; j++) {
      const pj = p[j]!;
      if (contains(c, pj)) continue;
      c = fromTwo(pi, pj);
      for (let k = 0; k < j; k++) {
        const pk = p[k]!;
        if (!contains(c, pk)) c = fromThree(pi, pj, pk);
      }
    }
  }
  return c;
}
