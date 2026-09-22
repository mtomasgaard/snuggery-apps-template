"""Run the prepared Norne deck with OPM Flow (Python bindings). About 8-10 minutes on one core."""
import argparse
import time
from pathlib import Path

import opm.simulators as sims


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--deck", default="work/norne/NORNE_ATW2013.DATA")
    ap.add_argument("--output-dir", default="work/results")
    ap.add_argument("--max-steps", type=int, default=0, help="stop after N report steps (smoke test)")
    args = ap.parse_args()

    out = Path(args.output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    deck = Path(args.deck).resolve()
    t0 = time.time()
    sim = sims.BlackOilSimulator(str(deck), args=[f"--output-dir={out}"])
    sim.step_init()
    n = 0
    while not sim.check_simulation_finished():
        sim.step()
        n += 1
        if n % 10 == 0:
            print(f"report step {n}, {time.time() - t0:.0f} s", flush=True)
        if args.max_steps and n >= args.max_steps:
            break
    sim.step_cleanup()
    print(f"Simulation finished: {n} report steps in {time.time() - t0:.0f} s, results in {out}")


if __name__ == "__main__":
    main()
