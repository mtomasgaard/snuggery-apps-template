#!/bin/sh
# Copies three.js and the fonts from node_modules into ../vendor and ../fonts.
# three.js addons import 'three'; they are rewritten to the relative module path because the app has no import map.
set -eu
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
N=node_modules; V=../vendor; F=../fonts
mkdir -p $V $F
cp $N/three/build/three.module.js $N/three/build/three.core.js $V/
cp $N/three/LICENSE $V/three-LICENSE.txt
cp $N/three/examples/jsm/controls/OrbitControls.js $N/three/examples/jsm/environments/RoomEnvironment.js $V/
sed -i.bak "s#from 'three'#from './three.module.js'#" $V/OrbitControls.js $V/RoomEnvironment.js && rm -f $V/*.bak
cp $N/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2 \
   $N/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2 \
   $N/@fontsource/newsreader/files/newsreader-latin-400-italic.woff2 \
   $N/@fontsource/newsreader/files/newsreader-latin-500-normal.woff2 $F/
echo "vendor and fonts updated"
