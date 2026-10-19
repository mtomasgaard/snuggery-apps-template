# What Hello Live reads, and what it can tell you

Hello Live is the loop's proof. It reads one file, `data/snapshot.json`, and
draws it: the headline the job wrote (a UTC clock time), the three rows under it
(the day of the year, the week and the minute of the day, all the same instant),
and the Time Card, which `ART.md` describes.

## Who writes the file

`scripts/refresh_hello_live.py`, run by `.github/workflows/refresh-hello-live.yml`
about every hour. **It fetches nothing**: the file's contents are the time the job
ran, written four ways. There is no outside source, no key, no account and nothing
to license. The app reads it again whenever it comes back to the screen.

## How the file reaches the phone

Two ways, and which is yours to choose. The app is the same either way; the
trade-offs are in the repository README, under *Getting the data to the phone:
two ways*.

- **Snuggery fetches it.** On Hello Live, open *Keep This Up To Date* in the
  options menu, paste the file's address and approve it once. The public
  template's copy is
  `https://mtomasgaard.github.io/snuggery-apps-template/hello-live/data/snapshot.json`,
  which needs no account and no key. In your own copy it is
  `https://<you>.github.io/<repo>/hello-live/data/snapshot.json` with Pages on,
  or, in a private copy with Pages off,
  `https://api.github.com/repos/<you>/<repo>/contents/hello-live/data/snapshot.json`
  with Snuggery signed in to GitHub. Snuggery fetches when the app is opened,
  when you come back to it, and from *Get New Data* under the refresh button;
  in the background only now and then, and only if you turn that on.
- **A Shortcut delivers it.** A row in your refresh shortcut's Dictionary: the
  key `Hello Live`, the value the same address (the raw address works too). The
  Shortcut runs at the times you set.

Hello Live is a good first test of either: its headline is the hour the job last
ran, so a new value about hourly proves the loop.

The schedule is best effort. GitHub runs an hourly cron when it has capacity, so
the headline is rarely on the hour, and a missed run is normal, not a fault.

## The stamp and the six hours

The stamp under the name says when the file was made, on the phone's clock:
`Updated 03:59`, or `Updated 1 Oct, 03:59` after the day. Six hours without a newer
file and it leads with `Stale.` in ink: the job writes about hourly, so six hours
means a hop (the job, the Shortcut or Snuggery's fetch, or the app being opened) has not run; About
gives the threshold. A file whose `generatedAt` is more
than an hour ahead of the phone's clock leads with `Made after the phone’s time.`;
one whose `generatedAt` does not parse says `Undated file.`. Words, never a color.

## The Time Card and its record

The card holds a mark for every file this app has parsed on this phone, at the
minute it was written, and a tail to the minute the app first read it. The record
behind it is one `localStorage` key, **`hello-live.card`**: a JSON array of
`[written, firstRead]` pairs in milliseconds, newest last, one per distinct
`generatedAt`, at most 400 long. Every read and write is wrapped in `try`/`catch`;
when storage is unavailable the record lives only as long as the page, and the
card shows the current file alone.

What the card can and cannot tell:

- An hourly job whose files a daily Shortcut carries, or whose app Snuggery fetches
  for but which is opened once a day, shows **one mark a day**: the card records
  what reached this app, not what the job did.
- An **empty day** is a job that did not run, a Shortcut or a fetch that did not
  run, or an app that was not opened. The card cannot tell which.
- The **tail** ends at the app's first reading, which is at or after the file's
  arrival on the phone. It says how long the file took to be seen here, never how
  long any one hop took.
- The **hours are the phone's clock**; the headline is the file's own words, in
  UTC. The caption under the card names the phone's offset.
- Removing the app or clearing its storage empties the record; the card starts
  again from the current file.

## The public copy's data

On the public repository the refresh job rewrites `data/snapshot.json` about every
hour, so the ZIP you install holds whatever the last run wrote. The private
template pins the committed file's hash in `tools/check.mjs`; a mirror leaves the
public `data/` alone.

## No network from the app

The app fetches `./data/snapshot.json` and nothing else. There is no external URL,
script or image anywhere in `index.html`, `app.js`, `style.css` or the two modules
in `js/`; the one typeface is a file in `fonts/`. Mini-apps in Snuggery cannot
reach the network, and this one does not try.

## Credits

- Data: this repository’s own refresh job; no outside source.
- Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.
  The subset is the template's house file, copied byte for byte from
  `global-weather/fonts/` (sha256 `fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262`).
