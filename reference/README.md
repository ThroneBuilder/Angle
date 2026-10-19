# Reference scripts

`FloorAngles.ps1`, `PythagoreanTriples.ps1`, and `DoubleAngles.ps1` are the original
PowerShell experiments behind Angle. They are kept here as references for checking results:
`export-fixtures.ps1` uses their formulas once to produce the frozen JSON in `tests/fixtures/`.

They are never imported by, bundled with, or deployed as part of the web app.

Units: the scripts count positions in whole steps. One `dx` step is the stud-to-stud distance
(10 LBU), and one `dy` step is a brick height (12 LBU) in `PythagoreanTriples.ps1`, or the
stud-to-stud distance (10 LBU) in `FloorAngles.ps1`. `$xlbu = 5` / `$ylbu = 6` are only the
10 : 12 ratio halved. `DoubleAngles.ps1` works directly in LBU.
