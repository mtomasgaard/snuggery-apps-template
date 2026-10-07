#!/usr/bin/env bash
# Build the Snuggery import archive: dist/volve.zip with one wrapping folder.
# Only the runtime files go in; pipeline/, scripts/, tools/, docs and dist/ stay out.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=volve
FILES=(index.html app.js style.css config.json miniapp.json NOTES.md ART.md js fonts data)
# Every runtime file is named here rather than globbed, so a new one is visible in the diff.
CODE=(index.html app.js style.css js/units.js js/data.js js/track.js js/section.js js/pane.js js/seismic.js)

# The app runs offline: refuse to package if any runtime code references a URL.
if grep -nE "https?://" "${CODE[@]}"; then
  echo "error: network URL found in runtime files" >&2; exit 1
fi
for f in fonts/ysabeau-office-gw.woff2 fonts/OFL.txt data/model.json data/geometry.bin data/neighbours.bin data/ijk.bin data/static.bin data/dynamic.bin \
         data/seismic.json data/seismic.bin data/horizons.bin data/validation.json data/ATTRIBUTION.txt data/TERMS-Volve-2026-10-07.txt; do
  [ -s "$f" ] || { echo "error: missing $f" >&2; exit 1; }
done

rm -rf dist && mkdir -p "dist/$APP"
cp -R "${FILES[@]}" "dist/$APP/"
(cd dist && zip -r -9 -q -X "$APP.zip" "$APP")
rm -rf "dist/$APP"
echo "Built $(pwd)/dist/$APP.zip ($(du -h "dist/$APP.zip" | cut -f1))"
