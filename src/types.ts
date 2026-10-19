// Plain-data types shared by the solver, worker, build, and views (data-model.md).
// Everything here must survive structured cloning: no classes, no functions.

/** An angle in integer tenths of a degree (1–899 for solving; 0 and 900 for tests). */
export type AngleTenths = number;

export type SurfaceTypeId =
  | 'brick'
  | 'liftarm'
  | 'technic'
  | 'plate'
  | 'baseplate'
  | 'technicWall'
  | 'hybridWall';

/** LDraw part number, without the `.dat` suffix. */
export type PartRef = string;
/** Catalog color id. */
export type ColorRef = number;

/** How a surface is drawn in 2D. Filled in by User Story 3. */
export interface DrawingStyle {
  readonly kind: string;
}

/** Parts that create a position between whole steps. Filled in by User Story 3. */
export interface FractionRule {
  readonly kind: string;
}

/** A binding-point step the builder can choose, such as a whole or a half stud. */
export interface StepChoice {
  readonly lbu: number;
  readonly label: string;
}

/**
 * Sizes as a count of whole units (studs, holes, bricks, layers). A count of n spans
 * n * unitLbu - insetLbu between its first and last binding points.
 */
export interface UnitCount {
  readonly unitLbu: number;
  readonly insetLbu: number;
  readonly singular: string;
  readonly plural: string;
  readonly min: number;
  readonly max: number;
}

export interface SurfaceType {
  readonly id: SurfaceTypeId;
  readonly name: string;
  readonly dimensions: 1 | 2;
  /** Default steps; the builder may pick another from the step choices. */
  readonly stepX: number;
  readonly maxX: number;
  readonly stepY?: number;
  readonly maxY?: number;
  readonly stepChoicesX: readonly StepChoice[];
  readonly stepChoicesY?: readonly StepChoice[];
  readonly countX: UnitCount;
  readonly countY?: UnitCount;
  /** Step used when this type is the top surface (research R6). */
  readonly receiveStepX: number;
  readonly receiveStepY?: number;
  readonly edgeOffset: number;
  readonly view: 'top' | 'side';
  readonly connectorKind: 'stud' | 'hole';
  readonly drawing: DrawingStyle;
  readonly fractionRules: readonly FractionRule[];
  readonly baseParts: readonly PartRef[];
}

export interface SurfaceSpec {
  readonly typeId: SurfaceTypeId;
  readonly sizeX: number;
  readonly sizeY?: number;
  /** Chosen binding-point steps; absent means the type's default. */
  readonly stepX?: number;
  readonly stepY?: number;
}

export type PlacementMode = 'centered' | 'shifted';

/** What the solver needs. Tolerance is not here: it is a filter (research R15). */
export interface Configuration {
  readonly top: SurfaceSpec;
  readonly bottom: SurfaceSpec;
  readonly placement: PlacementMode;
}

export interface FilterSettings {
  readonly toleranceLbu: number;
  readonly minConnections: number;
  /**
   * In top units (holes or studs, 10 LBU each), measured between top points. Connections closer
   * than minSpacing to one already kept are dropped; a solution qualifies only if its smallest
   * spacing is at most maxSpacing. 0 turns either limit off.
   */
  readonly minSpacing: number;
  readonly maxSpacing: number;
  /** Hide solutions whose worst error is above this, in LBU; 0 shows all (within tolerance). */
  readonly maxWorstErrorLbu: number;
}

/** A surface's binding-point grid, independent of surface type (keeps the solver generic). */
export interface GridSpec {
  readonly dimensions: 1 | 2;
  readonly stepX: number;
  readonly stepY: number;
  readonly sizeX: number;
  readonly sizeY: number;
}

export interface SolverInput {
  readonly top: GridSpec;
  readonly bottom: GridSpec;
  readonly placement: PlacementMode;
}

export interface GridIndex {
  readonly i: number;
  readonly j: number;
}

export interface BindingPoint extends GridIndex {
  readonly x: number;
  readonly y: number;
}

export interface Placement {
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface Connection {
  readonly top: GridIndex;
  readonly bottom: GridIndex;
  readonly errorLbu: number;
}

export interface AngleSolution {
  readonly angle: AngleTenths;
  /** Bit t set: this placement is the one shown when the tolerance falls in tier t (TIERS_LBU). */
  readonly tierMask: number;
  readonly placement: Placement;
  /** Sorted by bottom (j, i). */
  readonly connections: readonly Connection[];
  readonly worstErrorLbu: number;
}

export interface SolveResult {
  readonly config: Configuration;
  /** In angle order; an angle has at most one solution per tolerance tier. */
  readonly solutions: readonly AngleSolution[];
  readonly complete: boolean;
}

export interface BuildOptions {
  readonly trimToConnections: boolean;
}

export interface Connector {
  readonly at: Connection;
  readonly part: PartRef;
  readonly rotationDeg: number;
}

export interface PlacedPart {
  readonly part: PartRef;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationDeg: number;
  readonly color: ColorRef;
}

export interface Build {
  readonly config: Configuration;
  readonly filters: FilterSettings;
  readonly options: BuildOptions;
  readonly angle: AngleTenths;
  readonly placement: Placement;
  readonly connections: readonly Connection[];
  readonly bottomParts: readonly PlacedPart[];
  readonly topParts: readonly PlacedPart[];
  readonly connectors: readonly Connector[];
  readonly catalogVersion: string;
  readonly warnings: readonly string[];
}

export interface Catalog {
  readonly version: string;
  readonly snapshotDate: string;
  readonly source: { readonly provider: string; readonly url: string; readonly sha256: string };
  readonly parts: Readonly<
    Record<PartRef, { readonly name: string; readonly ldrawFile: string; readonly colors: readonly ColorRef[] }>
  >;
  readonly colors: Readonly<
    Record<ColorRef, { readonly name: string; readonly ldrawCode: number; readonly rgb: string }>
  >;
}
