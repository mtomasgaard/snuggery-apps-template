# Manual drop-in: Global Oil and Gas Extraction Tracker (GOGET)

Global Energy Monitor publishes GOGET as an Excel workbook behind a download form, so no job can
fetch it. To add or refresh the world field points:

1. Go to https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/download-data/
   (or the tracker's page), fill in the form, download the newest release (`.xlsx`).
2. Put the file in this folder. Keep GEM's file name (it carries the release, e.g.
   `Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx`); if several are here, the build takes
   the last one alphabetically, so a newer release should sort last. Delete old ones.
3. Run the *Build World Oil & Gas data* workflow (Actions → workflow_dispatch), or locally:
   `python3 -m scripts.shelf_atlas.build_world --out world-oil-gas/data`.
4. Commit the workbook together with the regenerated `world-oil-gas/data/fields.json`.

Licence: CC BY 4.0. The app's attribution screen names GEM and the release; keep it that way.

The current file is the March 2026 release. The parser (`scripts/shelf_atlas/build_world.py`,
`GOGET_COLS`) finds columns by name with aliases and reads the long-format production and reserves
sheets (one row per unit × fuel description). If GEM renames a column the build stops and prints the headers it found; add the new
name to the alias list rather than guessing.
