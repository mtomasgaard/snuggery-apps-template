// The racers' tones (ART.md 2): each body color's hue and chroma at a lightness fitted into the
// theme's band, for the marks the chrome draws (the Lap Chart, the map's dots, the faces' rings).
// TONES is `python3 snug-kart/tools/art/palette.py --json`, pasted; tools/check.mjs compares.

export const TONES = {"from": {"pip": "#F28C28", "juno": "#17A3A0", "otto": "#7D3C98", "wren": "#D9A21B", "soren": "#4A6FA5", "mabel": "#E0607E", "tuck": "#5B8C3A", "ines": "#3A3F47"}, "light": {"pip": "#7f4302", "juno": "#088e8c", "otto": "#692883", "wren": "#ab7e09", "soren": "#3b5f94", "mabel": "#bb3e60", "tuck": "#477724", "ines": "#3e434b"}, "dark": {"pip": "#e27d0a", "juno": "#65dcd8", "otto": "#b370d0", "wren": "#ffc854", "soren": "#80a7e1", "mabel": "#ff98ac", "tuck": "#8ec26e", "ines": "#818790"}};

export const isDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/** A racer's tone in a theme, while its body color is still the one it was fitted from; the data's own color otherwise. */
export function tone(racer, theme = isDark() ? 'dark' : 'light') {
  const from = TONES.from[racer.id];
  return from && from.toLowerCase() === String(racer.body).toLowerCase() ? TONES[theme][racer.id] : racer.body;
}

/** A chrome token's value now (--ink, --sheet …), for the 2D canvases. */
export const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
