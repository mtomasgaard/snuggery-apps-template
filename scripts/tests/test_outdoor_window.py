"""scripts/outdoor_window.py across the changes of the clocks, with no network.

The fixtures are outdoor-window/tools/dst/*.json, the replies the Shortcut's
address would have delivered at noon the day before each change (written by
outdoor-window/tools/dst/make_fixtures.py from what Open-Meteo returned,
measured 2026-10-06): every time in a reply is on one offset, the one in force
at the fetch, with no hour repeated or skipped. So the instants come from that
one offset, and the ask table's dates and times from the file's own zone.
outdoor-window/tools/test_dst.mjs checks the app against the same files.

    python3 -m unittest discover -s scripts/tests -v
"""

import collections
import copy
import json
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import outdoor_window as ow  # noqa: E402

DST = HERE.parent.parent / "outdoor-window" / "tools" / "dst"
RULES = json.loads((HERE.parent.parent / "outdoor-window" / "data" / "rules.json").read_text())

# fixture, the day of the change, how many hours that day has on the place's clock, its night in order
CASES = [
    ("oslo-fall-2026", "2026-10-25", 25, ["00:00", "01:00", "02:00", "02:00", "03:00", "04:00"]),
    ("oslo-fall-2025", "2025-10-26", 25, ["00:00", "01:00", "02:00", "02:00", "03:00", "04:00"]),
    ("oslo-spring-2026", "2026-03-29", 23, ["00:00", "01:00", "03:00", "04:00", "05:00"]),
    ("boston-fall-2026", "2026-11-01", 25, ["00:00", "01:00", "01:00", "02:00", "03:00"]),
    ("boston-fall-2025", "2025-11-02", 25, ["00:00", "01:00", "01:00", "02:00", "03:00"]),
]


def load(name):
    return json.loads((DST / f"{name}.json").read_text())


class AcrossTheChange(unittest.TestCase):
    def test_instants_are_an_hour_apart_on_the_one_offset(self):
        for name, *_ in CASES:
            with self.subTest(name):
                rows = ow.score_hours(load(name), RULES)
                self.assertEqual(len(rows), 48)
                self.assertEqual({b["epoch"] - a["epoch"] for a, b in zip(rows, rows[1:])}, {3600})

    def test_the_ask_table_is_on_the_place_clock(self):
        for name, day, hours, night in CASES:
            with self.subTest(name):
                ask = ow.ask_rows(load(name), RULES)
                per_day = collections.Counter(row["date"] for row in ask)
                self.assertEqual(per_day[day], hours)
                times = [row["time"] for row in ask if row["date"] == day]
                self.assertEqual(times[: len(night)], night)
                self.assertEqual(len(ask), 48)

    def test_without_a_usable_zone_the_labels_stand(self):
        for name, *_ in CASES:
            snap = load(name)
            for zone in (None, "Mars/Olympus_Mons", "Asia/Tokyo", "../etc/passwd", ""):
                with self.subTest(name=name, zone=zone):
                    other = copy.deepcopy(snap)
                    if zone is None:
                        del other["timezone"]
                    else:
                        other["timezone"] = zone
                    ask = ow.ask_rows(other, RULES)
                    self.assertEqual([(r["date"], r["time"]) for r in ask],
                                     [(t[:10], t[11:16]) for t in snap["hourly"]["time"]])

    def test_the_committed_demo_still_checks(self):
        self.assertEqual(ow.check(), 0)


if __name__ == "__main__":
    unittest.main()
