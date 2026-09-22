"""Shared paths for the Python build steps. Override with environment variables."""
import os
TOOLS = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(TOOLS)
DATA = os.environ.get('OUT_DATA', os.path.join(APP, 'data'))
WORK = os.environ.get('WORK_DIR', os.path.join(TOOLS, '.work'))
STL = os.environ.get('BP3D_STL_DIR', os.path.join(TOOLS, '.cache', 'stl'))
SOURCE = os.path.join(TOOLS, 'source')
for d in (DATA, WORK, STL):
    os.makedirs(d, exist_ok=True)
