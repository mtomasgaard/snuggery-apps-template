#!/usr/bin/env python3
"""Rewrite hello-live's snapshot.

Deliberately fetches nothing. The point of this app is to prove the loop —
schedule writes file, phone copies file, app shows it — without depending on
any external service that could fail and muddy the diagnosis. A real app
replaces this script with one that fetches something worth looking at; the
shape it writes is what matters.
"""

import json
import pathlib
import datetime

OUT = pathlib.Path(__file__).resolve().parent.parent / "hello-live" / "data" / "snapshot.json"
now = datetime.datetime.now(datetime.timezone.utc)

OUT.write_text(
    json.dumps(
        {
            # Every app's data file carries this. The app shows it, so a person
            # can tell at a glance whether the loop is still running.
            "generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "headline": now.strftime("%H:%M UTC"),
            "caption": "Written by a GitHub Action, copied here by a Shortcut.",
            "runs": [
                {"label": "Day of year", "value": now.strftime("%j")},
                {"label": "Week", "value": now.strftime("%V")},
                {"label": "Minute of day", "value": str(now.hour * 60 + now.minute)},
            ],
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(f"wrote {OUT} at {now.isoformat()}")
