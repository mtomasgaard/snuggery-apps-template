"""scripts/power_hours.py when the source is down, with no network.

The case on record: Energy-Charts answered HTTP 503 for both days around Oslo
midnight on 4-5 Oct 2026. The snapshot committed at 19:46Z on 4 Oct (public
commit b60a5b9, kept here as fixtures/power-hours-b60a5b9.json) already held
only 4 Oct, as `lastGood`; once Oslo's clock passed midnight that day was
yesterday, and the job failed three times in a row with nothing new to draw.
These tests pin what it does now: leave the committed file as it is, warn, and
exit 0; and still exit 1 when there is no snapshot to fall back to.

    python3 -m unittest discover -s scripts/tests -v
"""

import contextlib
import datetime as dt
import email.message
import io
import json
import pathlib
import sys
import tempfile
import types
import unittest
import urllib.error
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import power_hours as ph  # noqa: E402

FIXTURE = HERE / "fixtures" / "power-hours-b60a5b9.json"
OSLO = ph.ZoneInfo("Europe/Oslo")
LICENCE = "CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de"


def clock_at(instant):
    """The script's `dt`, with now() fixed at `instant` (aware, UTC)."""

    class Fixed(dt.datetime):
        @classmethod
        def now(cls, tz=None):
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    return types.SimpleNamespace(datetime=Fixed, date=dt.date, time=dt.time,
                                 timedelta=dt.timedelta, timezone=dt.timezone)


def answer(day, licence=LICENCE):
    """What urlopen hands back for one day that the source does have."""
    curve = ph.demo_curve("NO2", OSLO, day)
    body = json.dumps({"license_info": licence, "unix_seconds": [s for s, _ in curve],
                       "price": [p for _, p in curve], "unit": "EUR / MWh", "deprecated": False}).encode()
    response = mock.MagicMock()
    response.__enter__.return_value.read.return_value = body
    return response


def source(available, licence=LICENCE):
    """A fake urlopen: the days in `available` answer, every other day is a 503."""

    def urlopen(request, timeout=None):
        day = dt.date.fromisoformat(request.full_url.split("start=")[1].split("&")[0])
        if day in available:
            return answer(day, licence)
        raise urllib.error.HTTPError(request.full_url, 503, "Service Unavailable", email.message.Message(), None)

    return urlopen


def run(out, instant, urlopen):
    stdout, stderr = io.StringIO(), io.StringIO()
    with mock.patch.object(ph, "dt", clock_at(instant)), \
            mock.patch.object(ph.urllib.request, "urlopen", urlopen), \
            mock.patch.object(ph.time, "sleep", lambda seconds: None), \
            mock.patch.object(sys, "argv", ["power_hours.py", "--out", str(out)]), \
            contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = ph.main()
    return code, stdout.getvalue(), stderr.getvalue()


# 22:00Z on 4 Oct is midnight in Oslo: the first of the three failed runs.
MIDNIGHT = dt.datetime(2026, 10, 4, 22, 0, tzinfo=dt.timezone.utc)
MORNING = dt.datetime(2026, 10, 5, 10, 0, tzinfo=dt.timezone.utc)


class SourceDown(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.out = pathlib.Path(self.dir.name) / "snapshot.json"

    def tearDown(self):
        self.dir.cleanup()

    def test_both_days_503_with_a_snapshot_of_yesterday_leaves_it_and_warns(self):
        before = FIXTURE.read_bytes()
        self.assertEqual(json.loads(before)["lastGood"]["days"][0]["date"], "2026-10-04")
        for instant in (MIDNIGHT, MORNING):
            with self.subTest(at=instant.isoformat()):
                self.out.write_bytes(before)
                code, out, err = run(self.out, instant, source(set()))
                self.assertEqual(code, 0, err)
                self.assertEqual(self.out.read_bytes(), before, "the committed snapshot must be byte for byte as it was")
                warning = [line for line in out.splitlines() if line.startswith("::warning")]
                self.assertEqual(len(warning), 1, out)
                self.assertIn("HTTP 503 Service Unavailable", warning[0])
                self.assertIn("2026-10-05", warning[0])
                self.assertIn("2026-10-04T19:46:14Z", warning[0])
                self.assertNotIn("error:", err)

    def test_both_days_503_with_no_snapshot_fails(self):
        code, out, err = run(self.out, MIDNIGHT, source(set()))
        self.assertEqual(code, 1)
        self.assertIn("error: no curve, new or old, to draw", err)
        self.assertNotIn("::warning", out)

    def test_one_day_fetched_is_written_as_today(self):
        self.out.write_bytes(FIXTURE.read_bytes())
        today = dt.date(2026, 10, 5)
        code, out, err = run(self.out, MORNING, source({today}))
        self.assertEqual(code, 0, err)
        snap = json.loads(self.out.read_text())
        self.assertEqual([(d["date"], d["label"], d["source"]) for d in snap["days"]],
                         [("2026-10-05", "Today", "fetched"), ("2026-10-06", "Tomorrow", "failed")])
        self.assertEqual(snap["days"][1]["note"], "HTTP 503 Service Unavailable")
        self.assertIsNone(snap["lastGood"])
        self.assertEqual(len(snap["hours"]), 96)
        self.assertTrue(all(h["start"].startswith("2026-10-05T") for h in snap["hours"]))
        self.assertNotIn("::warning", out)

    def test_a_licence_change_still_fails_and_writes_nothing(self):
        before = FIXTURE.read_bytes()
        self.out.write_bytes(before)
        code, out, err = run(self.out, MORNING, source({dt.date(2026, 10, 5)}, licence="private and internal use only"))
        self.assertEqual(code, 1)
        self.assertIn("licence change", err)
        self.assertEqual(self.out.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
