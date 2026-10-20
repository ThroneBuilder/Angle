import { describe, expect, it } from 'vitest';
import { makeBuild } from '../../src/build/build.ts';
import { connectorAt, overlapWarnings } from '../../src/build/connectors.ts';
import { layoutSurface, tile } from '../../src/build/layout.ts';
import { isNative, offsetParts, platesBelow } from '../../src/build/offsets.ts';
import { trimSurface } from '../../src/build/trim.ts';
import { BRICKS, TECHNIC_BRICKS } from '../../src/catalog/candidates.ts';
import { CATALOG, isCurrent } from '../../src/catalog/catalog.ts';
import { qualifyingAngles } from '../../src/solver/filter.ts';
import { toSolverInput } from '../../src/solver/grid.ts';
import { groupSolutions } from '../../src/solver/group.ts';
import { solveRange } from '../../src/solver/solve.ts';
import { PRESETS, PRESET_IDS } from '../../src/surfaces/presets.ts';
import type { Connection } from '../../src/types.ts';

describe('layout (T045)', () => {
  it('tiles a length with the fewest parts', () => {
    expect(tile(BRICKS, 16)!.map((p) => p.n)).toEqual([16]);
    expect(tile(BRICKS, 15)!.map((p) => p.n)).toEqual([12, 3]);
    expect(tile(TECHNIC_BRICKS, 5)!.map((p) => p.n)).toEqual([4, 1]);
  });

  it('builds a 16 x 16 plate from one part, and a Technic wall from 12 rows of 1 x 16', () => {
    const warnings: string[] = [];
    expect(layoutSurface({ typeId: 'plate', sizeX: 150, sizeY: 150 }, 71, warnings).map((p) => p.part)).toEqual(['91405']);
    const wall = layoutSurface({ typeId: 'technicWall', sizeX: 150, sizeY: 132 }, 71, warnings);
    expect(wall).toHaveLength(12);
    expect(new Set(wall.map((p) => p.part))).toEqual(new Set(['3703']));
    expect(wall.map((p) => p.y)).toEqual([0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132]);
    expect(warnings).toEqual([]);
  });

  it('builds hybrid wall layers as plate, Technic brick, plate', () => {
    const layer = layoutSurface({ typeId: 'hybridWall', sizeX: 150, sizeY: 8 }, 71, []);
    expect(layer.map((p) => [p.kind, p.y, p.heightLbu])).toEqual([
      ['plate', -4, 4],
      ['plate', -4, 4],
      ['technic', 4, 12],
      ['plate', 12, 4],
      ['plate', 12, 4],
    ]);
  });

  it('uses the next longer liftarm when the exact length does not exist, and says so', () => {
    const warnings: string[] = [];
    const [arm] = layoutSurface({ typeId: 'liftarm', sizeX: 30 }, 72, warnings);
    expect(arm!.widthLbu).toBe(50);
    expect(warnings).toHaveLength(1);
  });
});

describe('offset parts (T046, FR-017)', () => {
  it('knows the native positions: Technic holes sit between studs', () => {
    expect(isNative('technicWall', 5, 0)).toBe(true);
    expect(isNative('technicWall', 0, 0)).toBe(false);
    expect(isNative('technicWall', 5, 4)).toBe(false);
    expect(isNative('hybridWall', 5, 4)).toBe(true);
    expect(isNative('plate', 0, 0)).toBe(true);
  });

  it('adds nothing at a native position or on stud surfaces', () => {
    expect(offsetParts('technicWall', 5, 12, 19)).toEqual([]);
    expect(offsetParts('plate', 5, 5, 19)).toEqual([]);
  });

  it('adds a 1 x 1 Technic brick for a half stud, and plates for a height between rows', () => {
    expect(offsetParts('technicWall', 0, 0, 19).map((p) => p.part)).toEqual(['6541']);
    expect(platesBelow('technicWall', 8)).toBe(2);
    expect(offsetParts('technicWall', 5, 8, 19).map((p) => p.part)).toEqual(['6541', '3024', '3024']);
  });
});

describe('connectors (T046, FR-020a)', () => {
  const at: Connection = { top: { i: 0, j: 0 }, bottom: { i: 0, j: 0 }, errorLbu: 0 };

  it('uses a pin where holes meet', () => {
    expect(connectorAt('technicWall', at, 5, 0, 0).placed.part).toBe('61332');
  });

  it('uses a round plate, a 1 x 2 jumper, or a 2 x 2 jumper on a plate', () => {
    expect(connectorAt('plate', at, 10, 20, 0).placed.part).toBe('6141');
    expect(connectorAt('plate', at, 15, 20, 0).placed).toMatchObject({ part: '15573', rotationDeg: 0 });
    expect(connectorAt('plate', at, 10, 25, 0).placed).toMatchObject({ part: '15573', rotationDeg: 90 });
    expect(connectorAt('plate', at, 15, 25, 0).placed.part).toBe('87580');
  });

  it('warns when risers overlap, but not when they only touch', () => {
    const a = connectorAt('plate', at, 15, 25, 0);
    expect(overlapWarnings([a, connectorAt('plate', at, 25, 25, 0)])).toHaveLength(1);
    expect(overlapWarnings([a, connectorAt('plate', at, 35, 25, 0)])).toEqual([]);
  });
});

describe('trim (T044, FR-020b)', () => {
  it('shrinks to whole studs around the connections', () => {
    // Plate points (step 5): columns 3 and 9 are 15 and 45 LBU; rows 2 and 4 are 10 and 20 LBU.
    const t = trimSurface({ typeId: 'plate', sizeX: 150, sizeY: 150 }, [{ i: 3, j: 2 }, { i: 9, j: 4 }], { stepX: 5, stepY: 5 }, []);
    expect(t).toEqual({ spec: { typeId: 'plate', sizeX: 40, sizeY: 10 }, offsetI: 2, offsetJ: 2 });
  });

  it('shrinks walls to whole bricks and hybrid walls to whole layers', () => {
    const wall = trimSurface({ typeId: 'technicWall', sizeX: 150, sizeY: 132 }, [{ i: 1, j: 3 }, { i: 5, j: 9 }], { stepX: 5, stepY: 4 }, []);
    expect(wall.spec.sizeY).toBe(24);
    expect(wall.offsetJ * 4).toBe(12);
    const hybrid = trimSurface({ typeId: 'hybridWall', sizeX: 150, sizeY: 108 }, [{ i: 1, j: 1 }, { i: 5, j: 6 }], { stepX: 5, stepY: 4 }, []);
    expect(hybrid.spec.sizeY).toBe(28);
    expect(hybrid.offsetJ).toBe(0);
  });

  it('never trims a baseplate', () => {
    const warnings: string[] = [];
    expect(trimSurface({ typeId: 'baseplate', sizeX: 310, sizeY: 310 }, [{ i: 1, j: 1 }], { stepX: 5, stepY: 5 }, warnings).spec.sizeX).toBe(310);
    expect(warnings).toHaveLength(1);
  });
});

describe('makeBuild (T047)', () => {
  for (const id of PRESET_IDS) {
    it(`${id}: current parts, settings copied, trimming keeps the connections`, () => {
      const p = PRESETS[id];
      const input = toSolverInput(p.config);
      const result = { config: p.config, solutions: solveRange(input, 300, 320), complete: true };
      const group = groupSolutions(qualifyingAngles(result, p.filters, input), input)[0]!;
      for (const trimToConnections of [false, true]) {
        const build = makeBuild({ solution: group.best, buildDeg: group.buildDeg, config: p.config, filters: p.filters, options: { trimToConnections }, catalog: CATALOG });
        const all = [...build.bottomParts, ...build.topParts, ...build.connectors.map((c) => c.placed)];
        for (const part of all) expect(isCurrent(CATALOG, part.part, part.color), `${part.part}/${part.color}`).toBe(true);
        expect(build.filters).toBe(p.filters);
        expect(build.catalogVersion).toBe(CATALOG.version);
        expect(build.connections).toBe(group.best.kept);
        expect(build.connectors).toHaveLength(group.best.kept.length);
      }
    }, 30_000);
  }
});
