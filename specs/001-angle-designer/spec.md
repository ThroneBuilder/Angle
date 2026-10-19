# Feature Specification: Angle Designer

**Feature Branch**: `001-angle-designer` (spec directory; no git branch was created by a hook)

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: (empty command; derived from `initial-spec.md`) "A webpage at
angle.thronebuilder.com for designing how to attach two LEGO surfaces at specific angles, building
on the brick-on-plate (`FloorAngles.ps1`), liftarm-against-wall (`PythagoreanTriples.ps1`), and
wall-on-wall (`DoubleAngles.ps1`) calculations. It covers presets, surface definitions, angle
solutions with filters, a protractor view, 2D and 3D solution rendering, and image, LDraw, and
CSV downloads."

## Clarifications

### Session 2026-10-19

- Q: Should the downloaded build and parts list include the parts that make each connection
  between the two surfaces? → A: Yes. Connecting parts are chosen automatically from the two
  surface types (Technic pin for hole to hole; direct stud or jumper plate for studs).
- Q: Should the build use the full surface sizes or be trimmed to the area around the
  connections? → A: Full sizes by default, with an option to trim each surface to the smallest
  standard part size that still covers every connection.
- Q: Should a design's settings be saved in the page link so it can be bookmarked or shared?
  → A: Yes. The link holds the configuration, filters, and selected angle, and opening it
  restores the exact design.
- Q: How should the page rank which angle solutions are best? → A: It doesn't rank them. An
  angle either qualifies or it doesn't, and the builder narrows the results with filters
  (tolerance, minimum connections, minimum gap). Connections usually repeat in a regular
  pattern, so the count mostly reflects surface size and spacing, which the filters already
  control. To qualify, a linear (1D) top needs at least 2 connections, and an area (2D) top needs
  at least 3 connections that are not all on one line.
- Q: Is tolerance a filter, or a calculation setting? → A: A filter. Matches are calculated once,
  at the largest tolerance the page allows, and the chosen tolerance only hides connections with
  larger errors. Changing it updates the list and drawings without recalculating.
- Q: Is a tolerance of zero allowed? → A: Yes, to show how rarely exact matches happen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the angles two surfaces can make (Priority: P1)

A LEGO builder wants to join two surfaces at an angle. They pick a preset (Brick on plate,
Plate on plate, Technic on wall, Hybrid wall on hybrid wall) or Custom. They see which angles
between 0.1° and 89.9° have connections where binding points on both surfaces line up within
tolerance. For each angle, the list shows how many connections it has and their worst error.
The builder can narrow the list by tolerance, minimum number of connections, and minimum gap
between connections.

**Why this priority**: This is the core value. It replaces running the three PowerShell scripts
by hand. With only this story, a builder can already pick an angle and the hole or stud
positions to use.

**Independent Test**: Load each preset. Compare the list of found angles and the matched
connection positions against the reference scripts' output for the same configuration.

**Acceptance Scenarios**:

1. **Given** the page is open, **When** the builder picks a preset, **Then** both surfaces are
   filled in with that preset's surface types and default sizes. The list of found angles
   appears with the connection count and worst error for each angle.
2. **Given** a preset is chosen, **When** the builder switches to Custom, **Then** the Custom
   settings show exactly the preset's values, and the found angles are unchanged.
3. **Given** found angles are listed, **When** the builder lowers the tolerance from 0.5 to
   0.2 LBU, **Then** angles and connections that are no longer within tolerance disappear from
   the list.
4. **Given** found angles are listed, **When** the builder sets a minimum of 4 connections,
   **Then** only angles with at least 4 connections remain.
5. **Given** an area (2D) top surface, **When** an angle has 3 or more connections that all lie
   on one line, **Then** that angle is not listed.
6. **Given** found angles are listed, **When** the builder sets a minimum connection gap,
   **Then** connections closer than that gap to another kept connection are dropped from each
   angle's count, and the minimum-connections filter applies to the reduced count.
7. **Given** a configuration from one of the reference scripts, **When** its angle is selected,
   **Then** the matched connections are the same as the script's matches. Any difference is
   listed as a known, justified correction.

---

### User Story 2 - Choose an angle on a protractor (Priority: P2)

The builder sees every qualifying angle as a mark on a protractor graphic from 0° to 90°. All
marks look the same: an angle either qualifies under the current filters or it doesn't. They
can select an angle either from the protractor
or from the list. Both stay in sync.

**Why this priority**: The protractor shows at a glance where solutions cluster and where the
gaps are. That is hard to see in a long list. The list from Story 1 already gives the same
choices, so this is an improvement, not a requirement.

**Independent Test**: With a preset loaded, click a highlighted mark and confirm the same angle
is selected in the list. Select an angle in the list and confirm the protractor highlights it.

**Acceptance Scenarios**:

1. **Given** found angles are listed, **When** the protractor is shown, **Then** every angle
   that passes the current filters has a mark, and no other angles do.
2. **Given** the protractor is shown, **When** the builder clicks a mark, **Then** that angle
   becomes the selected angle in the list.
3. **Given** a keyboard-only user, **When** they use the angle list, **Then** they can make
   every selection the protractor offers.

---

### User Story 3 - See each surface as LEGO parts (Priority: P3)

For the selected angle, each surface is drawn on its own in the style of its LEGO part, seen
from the top or the side as its surface type requires. The connections used are highlighted.
Wherever a connection falls between normal positions, the drawing includes the parts that create
the offset (jumper plates, 1×1 Technic bricks, extra plates).

**Why this priority**: A builder needs to see where to place each part. Lists of coordinates are
error-prone to translate into a build.

**Independent Test**: Select an angle in each preset and confirm the drawings show the correct
surface style, the right connections highlighted, and the offset parts wherever a connection
falls on a half position.

**Acceptance Scenarios**:

1. **Given** a selected angle, **When** the drawings are shown, **Then** each surface is drawn in
   its listed style (for example, a plate as a top view with studs, a hybrid wall as a side view
   of stacked 4, 12, 4 LBU layers).
2. **Given** a connection falls between normal binding positions, **When** the drawing is shown,
   **Then** the offset parts listed for that surface appear at that position.
3. **Given** a drawing is shown, **When** the builder chooses to download it, **Then** they get
   an image file of that drawing.

---

### User Story 4 - Inspect the assembly in 3D (Priority: P4)

The builder sees both surfaces layered at the selected angle in a 3D view they can rotate, with
the connections visible.

**Why this priority**: It confirms the build looks right before buying or assembling parts. The
2D drawings already contain the information needed to build.

**Independent Test**: Select an angle and rotate the 3D view. Confirm the top surface sits at the
selected angle and the visible connections match the 2D drawings.

**Acceptance Scenarios**:

1. **Given** a selected angle, **When** the 3D view is shown, **Then** the top surface is rotated
   by that angle relative to the bottom surface, and the connections are at the same positions
   as in the 2D drawings.
2. **Given** the 3D view, **When** the builder drags to rotate it, **Then** the view turns
   smoothly, and they can save the current view as an image.

---

### User Story 5 - Download the build and parts list (Priority: P5)

The builder downloads the selected solution as an LDraw build file and as a CSV parts list.

**Why this priority**: These hand the design off to LEGO CAD tools and parts ordering. They
depend on the solution and the part choices from the stories above.

**Independent Test**: Download both files for a selected angle. Open the LDraw file in a standard
LDraw viewer. Confirm the CSV part and color counts match the parts in the LDraw file exactly.

**Acceptance Scenarios**:

1. **Given** a selected angle, **When** the builder downloads the build, **Then** they get an
   LDraw file that opens in standard LDraw tools without errors and shows the same assembly as
   the 3D view.
2. **Given** a selected angle, **When** the builder downloads the parts list, **Then** they get a
   CSV with one row per part and color, whose quantities match the LDraw file exactly.

---

### Edge Cases

- No angle in 0.1°–89.9° has any connection that passes the current filters: the page says so
  and suggests loosening the tolerance, minimum connections, or gap.
- Too few connections to fix the angle (a single pin is a pivot): the angle does not qualify. The
  builder cannot set the minimum below the structural minimum (2 for a linear top, 3 for an area
  top).
- An area top whose connections all lie on one line, whatever their number: the top could swing
  about that line, so the angle does not qualify.
- Custom sizes that are not a multiple of the step, are zero, or are larger than the surface's
  maximum: the builder is told what is wrong, and the calculation does not run until it is fixed.
- A 1D surface chosen as the bottom surface: not allowed. Only 2D surfaces can be chosen as the
  bottom.
- Very large configurations (for example, baseplate on baseplate) where calculating every angle
  would take too long: the page shows progress, can be cancelled, stays usable, and falls back
  to calculating only the angle the builder enters.
- The builder changes a setting while a calculation is running: the old calculation stops and a
  new one starts from the new settings.
- Two angles that round to the same 0.1° label: each 0.1° step is shown once.
- Tolerance set to 0: allowed, to show how rare exact matches are. Only connections with zero
  error remain, and because angles are tested in 0.1° steps, usually no angle qualifies. The
  empty-state message explains this.
- Shifted placement finds more connections than centered placement at the same angle: the page
  shows the shifted result and its offset, and the builder can switch back to centered to compare.
- An offset moves top binding points off the edge of the bottom surface: those points do not
  count as connections.
- Trim to connections when no standard part size covers the connections exactly: the next
  larger standard size is used. For walls built from several parts, trimming shortens the
  layers and removes whole layers that hold no connections.

## Requirements *(mandatory)*

### Functional Requirements

**Surfaces and presets**

- **FR-001**: The page MUST offer these presets: Brick on plate, Plate on plate, Technic on wall,
  Hybrid wall on hybrid wall, and Custom.
- **FR-002**: The page MUST support these surface types, with the steps, maximums (in LBU),
  dimensionality, and drawing styles from the Surfaces table in `initial-spec.md`: Brick, Liftarm,
  Technic, Plate, Baseplate, Technic Wall, Hybrid Wall.
- **FR-003**: Every preset MUST be equivalent to a Custom configuration (top surface, bottom
  surface, sizes, tolerance). Switching from a preset to Custom MUST keep its values.
- **FR-004**: The bottom surface MUST be 2D. The top surface MAY be 1D or 2D.
- **FR-005**: In Custom mode, the builder MUST be able to choose each surface's type and set its
  size within that type's step and maximum.

**Solving**

- **FR-006**: Each surface's binding points MUST be the grid of positions at its X and Y steps
  from 0 to its maximum. All measurements are in LBU, where a brick is 10 LBU wide and 12 LBU
  high.
- **FR-007**: To test an angle, the top surface's binding points MUST be rotated by that angle
  around the shared center point, and compared with the bottom surface's binding points. This
  centered placement is the default.
- **FR-007a**: The builder MUST be able to turn on shifted placement. With it on, the page MUST
  also look for a sideways offset of the rotated top surface that gives more connections, or
  connections with smaller errors. No connection is required to line up exactly. The offset
  itself is part of the result, so every connection's error is measured after the shift and
  stays within the tolerance.
- **FR-007b**: With shifted placement on, each angle solution MUST state its offset from the
  centered placement, and the drawings, 3D view, and downloads MUST use that offset.
- **FR-007c**: When several offsets give the same number of connections at one angle, the page
  MUST prefer the one with the smallest worst error, then the one closest to centered.
- **FR-008**: A pair of points MUST count as a connection only if the distance between them is
  within the tolerance. The default tolerance is 0.5 LBU, and the builder can set it anywhere
  from 0 to 1.0 LBU. Tolerance is a filter (FR-011): changing it MUST NOT recalculate matches.
- **FR-009**: Every connection MUST show its error (distance in LBU).
- **FR-010**: The page MUST test every angle from 0.1° to 89.9° in 0.1° steps for the current
  configuration, and list each angle that has connections, with its connection count and worst
  error.
- **FR-011**: The builder MUST be able to filter found angles by tolerance, minimum number of
  connections, and minimum gap between connections. The minimum number of connections defaults
  to, and cannot go below, the structural minimum in FR-011a. Filters MUST only change which
  results are shown. They MUST NOT change how points are calculated.
- **FR-011a**: An angle MUST qualify only if, after the gap filter, it has at least 2 connections
  for a linear (1D) top, or at least 3 connections that are not all on one line for an area (2D)
  top.
- **FR-011b**: The page MUST NOT rank or score qualifying angles. Every qualifying angle MUST be
  shown the same way, and the list MUST be in angle order.
- **FR-012**: Results MUST be the same every time for the same settings, in every supported
  browser.
- **FR-013**: The calculation MUST show progress, MUST be cancellable, and MUST NOT freeze the
  page. If testing every angle would exceed the time budget, the builder MUST still be able to
  test a single angle they enter.

**Choosing an angle**

- **FR-014**: Qualifying angles MUST be shown both as a list and as identical marks on a 0°–90°
  protractor. A selection in either MUST update the other.
- **FR-015**: Everything the protractor offers MUST also be possible from the list using only a
  keyboard.

**Rendering and downloads**

- **FR-016**: For the selected angle, each surface MUST be drawn on its own in the style for its
  type, with its connections highlighted.
- **FR-017**: Where a connection needs a fractional offset, the drawing MUST show the offset
  parts listed for that surface type.
- **FR-018**: The page MUST show a 3D view of both surfaces at the selected angle, which the
  builder can rotate.
- **FR-019**: The builder MUST be able to download each drawing and the current 3D view as an
  image.
- **FR-020**: The builder MUST be able to download the selected solution as an LDraw build file,
  and as a CSV parts list whose part and color counts match the LDraw file exactly.
- **FR-020a**: The build file and parts list MUST include a connecting part at every connection,
  chosen automatically from the two surface types: a Technic pin where a hole meets a hole, and
  no extra part (direct stud) or a jumper plate where a stud is used. The 3D view MUST show the
  same connecting parts.
- **FR-020b**: By default, the build MUST use the full surface sizes from the configuration. The
  builder MUST be able to turn on "trim to connections", which shrinks each surface to the
  smallest standard part size that still covers every connection. Trimming MUST NOT change the
  angle, placement, or connections. The drawings, 3D view, and both downloads MUST all reflect
  whether trimming is on.
- **FR-021**: The 2D drawings, 3D view, LDraw file, and parts list MUST all describe the same
  solution: the same parts, positions, and connections.
- **FR-022**: Builds and parts lists MUST use only LEGO parts and colors that are currently
  produced.
- **FR-023**: Every result MUST state its settings: surfaces, sizes, tolerance, filters, and
  the version of the parts catalog used.

**Sharing**

- **FR-024**: The page link MUST always reflect the current configuration (surfaces, sizes,
  placement mode), filters (tolerance, minimum connections, gap), trim setting, and selected
  angle. Opening that link MUST
  restore the same design and the same results.
- **FR-025**: A link with missing, unknown, or out-of-range values MUST still open. Invalid values
  fall back to the preset defaults, and the page says which values were replaced.

### Key Entities

- **Surface type**: A kind of LEGO surface (for example, Plate or Hybrid Wall). It has X and Y
  steps, X and Y maximums, whether it is 1D or 2D, a default size, a drawing style, and the parts
  used to create fractional offsets.
- **Surface**: A surface type at a chosen size, used as the top or bottom of a design.
- **Binding point**: A position on a surface where a stud, hole, or pin can connect, in LBU.
- **Configuration**: A top surface, a bottom surface, and a placement mode (centered or shifted).
  A preset is a named configuration, together with its default filter settings.
- **Placement**: The offset of the rotated top surface from the centered position, in LBU. It is
  zero in centered mode.
- **Connection**: A top binding point and a bottom binding point that line up within tolerance at
  a given angle, with its error.
- **Angle solution**: An angle (in 0.1° steps), its placement, and its connections, with
  connection count and worst error.
- **Filter settings**: Tolerance, minimum connections, and minimum connection gap.
- **Connector**: The part that joins a top binding point to a bottom binding point at a
  connection (for example, a Technic pin). It is chosen from the pair of surface types.
- **Build**: The parts, colors, and positions that make up a chosen solution, including the
  surfaces, offset parts, and connectors. The drawings, the 3D view, and both downloads all use
  it.
- **Parts catalog**: The versioned list of currently produced LEGO parts and colors that builds
  may use, with its source and date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the three reference scripts' configurations, the found angles and
  connection positions match the script's output 100%, or every difference is documented and
  justified.
- **SC-002**: For each of the four named presets, the full list of found angles appears within
  10 seconds on a typical laptop, and the page stays responsive throughout.
- **SC-003**: After selecting an angle, the 2D drawings and 3D view appear within 1 second.
- **SC-004**: A builder who has not used the page before can go from opening it to downloading a
  build file for a preset in under 3 minutes.
- **SC-005**: 100% of downloaded build files open without errors in standard LDraw viewers, and
  100% of parts lists match their build file's part and color counts.
- **SC-006**: Running the same configuration twice, in any supported browser, gives identical
  results every time.
- **SC-007**: The project owner can physically assemble at least one solution from each preset
  using only the downloaded files, and every connection fits without forcing.
- **SC-008**: Opening a shared design link in a fresh browser shows the same selected angle,
  connections, and downloads as the browser it was shared from, 100% of the time.

## Assumptions

- **Audience**: LEGO builders who are comfortable with stud, hole, and LBU measurements. The
  first user is the project owner. There are no accounts and no server-side storage. A design is
  kept only in its page link.
- **Preset mapping**: Brick on plate = Brick on Plate. Plate on plate = Plate on Plate. Technic
  on wall = Liftarm on Technic Wall. Hybrid wall on hybrid wall = Hybrid Wall on Hybrid Wall.
  Baseplate and Technic brick are available only in Custom.
- **Default sizes**: Each surface type defaults to the size in the Surfaces table (for example,
  16×16 Plate, 1×15 Liftarm).
- **Edge offsets**: Binding points start 5 LBU from a brick edge and 6 LBU from a wall edge,
  as the table's maximums imply. This is to be confirmed by prototype.
- **Reference scripts**: `FloorAngles.ps1`, `PythagoreanTriples.ps1`, and `DoubleAngles.ps1`
  are references for checking results only. They are not part of the product, and the page does
  not run or ship them. Because the scripts anchor one connection with zero error, shifted
  placement is expected to find everything they find and possibly more.
- **Tolerance**: The default is 0.5 LBU (observed pin tolerance), not the 0.4 LBU used in
  `DoubleAngles.ps1`.
- **Angle range**: 0.1° to 89.9° only. Other angles are mirror images of these.
- **Wall-on-wall shortcut**: Simplifying wall-on-wall results to the mirror-image half-angle
  pattern, and suggesting a build size that covers 4–6 binding points, are out of scope. Results
  come from the general solver.
- **Browsers**: Current desktop versions of Chrome, Edge, Firefox, and Safari. Phone layouts
  must work, but are not optimized.
- **Hosting**: A static page at angle.thronebuilder.com, with all calculation done in the
  browser, as the constitution requires.
