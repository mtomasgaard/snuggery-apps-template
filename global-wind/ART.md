# Global Wind — art direction

The same direction as Global Weather: **Long Exposure**. Its `ART.md`, in
`global-weather/` beside this folder in the template repository, is the whole
of it: the tokens, the type scale, the ramps, every object of the chrome and
the contrast figures. This app is a copy made by hand, because a mini-app is one
folder. What the direction is, in five lines:

- **The screen is a flow photograph of the air, with its caption.** Each streak
  is a tracer carried by the forecast's wind at its place and hour; the caption
  under the plate states the exposure (`Streaks: 1 s = 24 h of wind at the hour
  shown`) and the scale; the credits are in About, one tap from the stamp.
- **Dark theme: the print** (pale tracers on a dark plate). **Light theme: the
  negative** (ink tracers on a pale, faintly cyan film base).
- **One bold thing, the streaks.** Everything else is quiet: one face (Ysabeau
  Office), no accent color, no glass, no shadows, no gradient in the chrome but
  the data scale and the selection tracer under a chosen word.
- **The ramp is one hue path printed twice**, its lightness inverted between the
  themes, inside a tonal budget so a one-point streak reads over any of it:
  3.0:1 by day and 2.5:1 at night, on the streak's head.
- **Honesty is the metaphor.** The streaks come from the field and nowhere else,
  the exposure is printed, the forecast's age never leaves the screen, and
  NOAA's "sampled" is the credit line's, first in About.

## How this app differs

- **No layer words.** The header's third row holds `Map` and `Globe`, and at its
  right **`Speed colors`**: a word that turns the color layer on and off,
  marked by the same tracer as a chosen view. It replaces Global Wind 1.0's icon
  key and keeps its stored choice (`gw.heat`). Its accessible name is its own
  words, described as "Colors the map by wind speed": a name that left out the
  visible words would fail WCAG 2.5.3, so the sentence Global Weather's `ART.md`
  proposed as the name is the description instead.
- **Speed colors off** shows the plate's bare ground under the streaks. The
  legend's bar steps aside but keeps its height, so the plate never moves.
- **An Arrows key** joins Flow and Night in the key column (1.0 drew its arrows
  always), so the pair has the same four states.
- **One ramp**, the wind's, with Global Weather's stops: `js/ramps.js` is the
  `wind` entry of `tools/art/palette.py --json`, and the streak heads are
  measured over it and over the bare plate.
- **The readout card** holds the wind alone: the speed, a streak glyph turned to
  where the air goes, and the line in words (`From SW (215°), gentle breeze,
  Beaufort 3`).
- **The face** is a byte-for-byte copy of Global Weather's two files in
  `fonts/`, not rebuilt here.

Fixed here before Global Weather, from that app's final review: the coast is no
longer stroked along the bottom of the whole-world map, the place names make
room for a card the moment it opens, and the arrows' caption prints `up to
25 m/s` rather than `25.0`.
