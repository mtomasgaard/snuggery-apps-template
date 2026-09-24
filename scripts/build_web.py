#!/usr/bin/env python3
"""Assemble the browser copy of every app, for GitHub Pages.

Snuggery installs an app from its ZIP; a browser opens it from a web address.
This builds the second from the same folders as the first: every top-level
directory holding an index.html is an app, copied less exactly what the ZIP
builder leaves out (dotfiles, screenshots/, tools/, pipeline/, scripts/, dist/,
raw/). So what a browser gets is what a phone gets — raw/ in particular, which
in a private copy is personal history, is never published.

It changes nothing in the repository. It writes one folder (default `_site/`),
which .github/workflows/publish-web.yml uploads to Pages, plus an index page
listing the apps, built from each one's miniapp.json.

    python3 scripts/build_web.py                 # writes _site/
    python3 -m http.server -d _site 8000         # then open localhost:8000
"""

import argparse
import html
import json
import os
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOT_APPS = {".github", "scripts", "zips", "scheduler"}

# ── The app this index belongs to ────────────────────────────────────────────
# The index links the phone app these examples are made for, and borrows its
# site's colours. A copy of this template is your repository, not ours: put
# your own name and links here, or set the three strings to "" and the header
# line, the sentence about the phone version and the palette below all go —
# the index then names nothing but itself.
SITE_NAME = "Snuggery"
SITE_URL = "https://mtomasgaard.github.io/snuggery/"
APP_STORE_URL = "https://apps.apple.com/app/id6805883209"
# Light, then dark: canvas, card, ink, muted ink, hairline, accent.
PALETTE = {
    "light": ("#f5f5fa", "#ffffff", "#131320", "#55556b", "#e6e6f0", "#5b5bd6"),
    "dark":  ("#131320", "#1d1d2b", "#f2f2f7", "#a3a3b8", "#2c2c3d", "#818cf8"),
}
# Kept in step with the zip -x list in .github/workflows/build-zips.yml.
LEFT_OUT = {"screenshots", "tools", "pipeline", "scripts", "dist", "raw"}


def ignore(directory, names):
    top = pathlib.Path(directory).parent == ROOT
    return [n for n in names if n.startswith(".") or (top and n in LEFT_OUT)]


def apps():
    for d in sorted(ROOT.iterdir()):
        if d.is_dir() and d.name not in NOT_APPS and not d.name.startswith(".") and (d / "index.html").is_file():
            meta = {}
            try:
                meta = json.loads((d / "miniapp.json").read_text())
            except (OSError, ValueError):
                pass
            yield d, meta


def page(cards, repo):
    zip_base = f"https://github.com/{repo}/raw/main/zips" if repo else "../zips"
    items = []
    for name, meta, preview in cards:
        title = html.escape(meta.get("name") or name)
        desc = html.escape(meta.get("description") or "")
        img = (f'<img src="{html.escape(preview)}" alt="" loading="lazy">' if preview
               else '<div class="noimg" aria-hidden="true"></div>')
        items.append(f"""
      <li class="card">
        <a class="shot" href="{html.escape(name)}/">{img}</a>
        <div class="body">
          <h2><a href="{html.escape(name)}/">{title}</a></h2>
          <p>{desc}</p>
          <p class="links"><a class="open" href="{html.escape(name)}/">Open in browser</a>
            <a href="{zip_base}/{html.escape(name)}.zip">Get the ZIP</a></p>
        </div>
      </li>""")
    source = f"https://github.com/{repo}" if repo else ".."
    branded = bool(SITE_NAME and SITE_URL and APP_STORE_URL)
    header = (f'  <p class="site"><a href="{html.escape(APP_STORE_URL)}">{html.escape(SITE_NAME)} on the App Store</a>'
              f' · <a href="{html.escape(SITE_URL)}">About {html.escape(SITE_NAME)}</a></p>\n') if branded else ""
    phone = (f" Only the phone version, <a href=\"{html.escape(APP_STORE_URL)}\">{html.escape(SITE_NAME)}</a>, has"
             " your own files beside the apps, editing an app's data, Ask about a file, the Shortcut that"
             " refreshes an app every morning, and a sandbox that runs it all offline.") if branded else ""
    light, dark = PALETTE["light"], PALETTE["dark"]
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Snuggery live apps</title>
<style>
  :root {{ --bg:{light[0]}; --card:{light[1]}; --ink:{light[2]}; --muted:{light[3]}; --line:{light[4]}; --accent:{light[5]}; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:{dark[0]}; --card:{dark[1]}; --ink:{dark[2]}; --muted:{dark[3]}; --line:{dark[4]}; --accent:{dark[5]}; }}
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink);
         font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }}
  main {{ max-width:1100px; margin:0 auto; padding:32px 16px 48px; }}
  h1 {{ margin:0 0 8px; font-size:28px; letter-spacing:-0.02em; }}
  .site {{ margin:0 0 12px; font-size:15px; }}
  .lede {{ color:var(--muted); margin:0 0 28px; max-width:70ch; }}
  a {{ color:var(--accent); }}
  ul {{ list-style:none; padding:0; margin:0; display:grid; gap:16px;
       grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden;
          display:flex; flex-direction:column; }}
  .shot {{ display:block; aspect-ratio:16/10; background:var(--line); }}
  .shot img {{ width:100%; height:100%; object-fit:cover; object-position:top; display:block; }}
  .noimg {{ width:100%; height:100%; }}
  .body {{ padding:14px 16px 16px; display:flex; flex-direction:column; flex:1; }}
  h2 {{ font-size:18px; margin:0 0 4px; }}
  h2 a {{ color:inherit; text-decoration:none; }}
  .body p {{ margin:0 0 12px; color:var(--muted); font-size:14px; }}
  .links {{ margin-top:auto !important; display:flex; gap:16px; align-items:center; }}
  .open {{ font-weight:600; }}
  footer {{ margin-top:32px; color:var(--muted); font-size:14px; }}
</style>
</head>
<body>
<main>
  <h1>Snuggery live apps</h1>
{header}  <p class="lede">Every app in <a href="{source}">the repository</a>, running in the browser. Each shows the
  data last published here; on a phone, <strong>Get the ZIP</strong> in Safari and share it to Snuggery to
  install it instead. The big 3D apps download tens of megabytes on first open.{phone}</p>
  <ul>{"".join(items)}
  </ul>
  <footer>How the data reaches the apps: <a href="data-flow.html">the loop, animated</a>.</footer>
</main>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", default=str(ROOT / "_site"))
    args = ap.parse_args()
    out = pathlib.Path(args.out).resolve()
    if out == ROOT or ROOT.is_relative_to(out):
        raise SystemExit(f"refusing to write into {out}")
    shutil.rmtree(out, ignore_errors=True)
    (out / "_previews").mkdir(parents=True)

    cards = []
    for d, meta in apps():
        shutil.copytree(d, out / d.name, ignore=ignore)
        preview = None
        shot = d / "screenshots" / "app.png"
        if shot.is_file():
            shutil.copyfile(shot, out / "_previews" / f"{d.name}.png")
            preview = f"_previews/{d.name}.png"
        cards.append((d.name, meta, preview))
        print(f"copied {d.name}")

    if (ROOT / "data-flow.html").is_file():
        shutil.copyfile(ROOT / "data-flow.html", out / "data-flow.html")
    (out / "index.html").write_text(page(cards, os.environ.get("GITHUB_REPOSITORY", "")))
    print(f"{len(cards)} apps in {out}")


if __name__ == "__main__":
    main()
