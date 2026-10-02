#!/bin/sh
# Copies three.js from node_modules into ../vendor. The type, the house face, is copied from
# Global Weather's fonts/ byte for byte (ART.md section 4), never from here.
# three.js addons import 'three'; they are rewritten to the relative module path because the app has no import map.
set -eu
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
N=node_modules; V=../vendor
mkdir -p $V
cp $N/three/build/three.module.js $N/three/build/three.core.js $V/
cp $N/three/LICENSE $V/three-LICENSE.txt
cp $N/three/examples/jsm/controls/OrbitControls.js $N/three/examples/jsm/environments/RoomEnvironment.js $V/
sed -i.bak "s#from 'three'#from './three.module.js'#" $V/OrbitControls.js $V/RoomEnvironment.js && rm -f $V/*.bak
echo "vendor updated"
