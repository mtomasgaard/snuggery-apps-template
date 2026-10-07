#!/usr/bin/env bash
# Run OPM Flow 2026.04 on the prepared Volve deck, in the official Docker image pinned by digest.
# Linux x86_64 with Docker. Usage: run_flow.sh <prepared deck folder> <output folder> [processes]
# processes: MPI ranks (default: nproc); 1 runs Flow without mpirun.
# mpirun gets --oversubscribe and --bind-to none: with no hostfile, OpenMPI 4.1 counts one slot per
# physical core, and a 4-vCPU hosted runner can be 2 cores x 2 threads, so 4 ranks would otherwise be
# refused ("not enough slots"). The CPU listing goes into the log so each run states its hardware.
set -euo pipefail
# openporousmedia/opmreleases:2026.04_amd64 (Ubuntu 24.04, libopm-simulators-bin from ppa:opm/ppa,
# openmpi-bin), built 2026-05-20. A digest, not a tag: the bytes cannot change under us.
IMAGE="openporousmedia/opmreleases@sha256:db8865d7c80440513c8c73df7ed385a3b7d2e055a0ef95f7662ec06ef6a6b3a9"
DECK_DIR=$(cd "$1" && pwd)
mkdir -p "$2"
OUT=$(cd "$2" && pwd)
NP=${3:-$(nproc)}
chmod a+rwx "$OUT"   # the image runs as its own user 'opm'
echo "nproc: $(nproc)"
lscpu || true
docker pull --quiet "$IMAGE"
docker run --rm "$IMAGE" flow --version
RUN=(docker run --rm --shm-size=2g -e OMP_NUM_THREADS=1 -e OMPI_MCA_btl_vader_single_copy_mechanism=none
     -v "$DECK_DIR":/deck:ro -v "$OUT":/out -w /deck "$IMAGE")
start=$(date +%s)
if [ "$NP" -gt 1 ]; then
  "${RUN[@]}" mpirun --oversubscribe --bind-to none -np "$NP" flow VOLVE_2016.DATA --output-dir=/out
else
  "${RUN[@]}" flow VOLVE_2016.DATA --output-dir=/out
fi
echo "OPM Flow finished in $(( $(date +%s) - start )) s with $NP process(es); results in $OUT"
ls -l "$OUT"
