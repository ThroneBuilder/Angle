import { describe, expect, it } from 'vitest';
import { bindingPoints, gridFor } from '../../src/solver/grid.ts';

describe('bindingPoints', () => {
  it('builds a 31 x 31 grid for a 16x16 plate, centered', () => {
    const points = bindingPoints(gridFor({ typeId: 'plate', sizeX: 150, sizeY: 150 }, 'bottom'));
    expect(points).toHaveLength(961);
    expect(points[0]).toEqual({ i: 0, j: 0, x: -75, y: -75 });
    expect(points.at(-1)).toEqual({ i: 30, j: 30, x: 75, y: 75 });
  });

  it('builds a line of 15 holes for a liftarm', () => {
    const points = bindingPoints(gridFor({ typeId: 'liftarm', sizeX: 140 }, 'top'));
    expect(points).toHaveLength(15);
    expect(points[0]).toEqual({ i: 0, j: 0, x: -70, y: 0 });
    expect(points.at(-1)).toEqual({ i: 14, j: 0, x: 70, y: 0 });
  });

  it('builds 31 x 28 points for a hybrid wall', () => {
    const points = bindingPoints(gridFor({ typeId: 'hybridWall', sizeX: 150, sizeY: 108 }, 'bottom'));
    expect(points).toHaveLength(31 * 28);
  });

  it('uses a chosen step: whole studs and whole bricks on a Technic wall', () => {
    const grid = gridFor({ typeId: 'technicWall', sizeX: 150, sizeY: 132, stepX: 10, stepY: 12 }, 'bottom');
    expect(grid).toMatchObject({ stepX: 10, stepY: 12 });
    expect(bindingPoints(grid)).toHaveLength(16 * 12);
  });

  it('orders points by j, then i', () => {
    const points = bindingPoints(gridFor({ typeId: 'plate', sizeX: 10, sizeY: 10 }, 'bottom'));
    expect(points.map((p) => [p.j, p.i])).toEqual([
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ]);
  });
});
