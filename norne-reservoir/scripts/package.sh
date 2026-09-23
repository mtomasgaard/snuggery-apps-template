#!/usr/bin/env bash
# Build the Snuggery import archive: dist/norne-reservoir.zip with one wrapping folder.
# Only the runtime files go in; pipeline/, scripts/, docs and dist/ stay out.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=norne-reservoir
FILES=(index.html app.js topside.js topside-network.js style.css config.json miniapp.json data)
# Every runtime file is named here rather than globbed, so a new one is visible in the diff.
CODE=(index.html app.js topside.js topside-network.js style.css)

# The app runs offline: refuse to package if any runtime code references a URL.
if grep -nE "https?://" "${CODE[@]}"; then
  echo "error: network URL found in runtime files" >&2; exit 1
fi
for f in data/model.json data/geometry.bin data/neighbours.bin data/ijk.bin data/static.bin data/dynamic.bin data/topside.json; do
  [ -s "$f" ] || { echo "error: missing $f" >&2; exit 1; }
done

# The topside fixtures carry "fixture": true. They are real numbers but they are not the
# pipeline's output, so they must never reach a release.
for f in data/topside.json data/topside-network.json; do
  [ -e "$f" ] || continue
  if grep -q '"fixture"[[:space:]]*:[[:space:]]*true' "$f"; then
    echo "error: $f is a fixture, not the pipeline's output" >&2; exit 1
  fi
done

rm -rf dist && mkdir -p "dist/$APP"
cp -R "${FILES[@]}" "dist/$APP/"
(cd dist && zip -r -9 -q -X "$APP.zip" "$APP")
rm -rf "dist/$APP"
echo "Built $(pwd)/dist/$APP.zip ($(du -h "dist/$APP.zip" | cut -f1))"
