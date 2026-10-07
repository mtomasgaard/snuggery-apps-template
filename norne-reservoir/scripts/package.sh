#!/usr/bin/env bash
# Build the Snuggery import archive: dist/norne-reservoir.zip with one wrapping folder.
# Only the runtime files go in; pipeline/, scripts/, docs and dist/ stay out.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=norne-reservoir
FILES=(index.html app.js style.css config.json miniapp.json js fonts data)
# Every runtime file is named here rather than globbed, so a new one is visible in the diff.
CODE=(index.html app.js style.css js/units.js js/data.js js/track.js js/section.js js/pane.js)

# The app runs offline: refuse to package if any runtime code references a URL.
if grep -nE "https?://" "${CODE[@]}"; then
  echo "error: network URL found in runtime files" >&2; exit 1
fi
for f in fonts/ysabeau-office-gw.woff2 fonts/OFL.txt data/model.json data/geometry.bin data/neighbours.bin data/ijk.bin data/static.bin data/dynamic.bin; do
  [ -s "$f" ] || { echo "error: missing $f" >&2; exit 1; }
done

rm -rf dist && mkdir -p "dist/$APP"
cp -R "${FILES[@]}" "dist/$APP/"
(cd dist && zip -r -9 -q -X "$APP.zip" "$APP")
rm -rf "dist/$APP"
echo "Built $(pwd)/dist/$APP.zip ($(du -h "dist/$APP.zip" | cut -f1))"
