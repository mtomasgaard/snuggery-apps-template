"""Basemap and boundaries for the North Sea app.

  Natural Earth 1:10m (public domain): coastline, countries (land fill), bathymetry 200 m polygons.
  Marine Regions (Flanders Marine Institute), Maritime Boundaries v12, CC BY 4.0: the median lines
  between Norway, the UK, Denmark, the Netherlands, Germany, Belgium, Sweden and the Faroes.
  EMODnet Human Activities (CC BY 4.0): pipelines and platforms for Denmark and the Netherlands,
  where the national regulators publish none as open data; other countries' pipelines come from
  their regulators, so EMODnet is filtered by country.
"""
from __future__ import annotations

import json
import urllib.parse

from .common import BuildError, Cache, clip_line_to_bbox, clip_polygon_to_bbox, log, ring_area_m2, simplify

NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
VLIZ = "https://geo.vliz.be/geoserver/MarineRegions/wfs"
EMODNET = "https://ows.emodnet-humanactivities.eu/wfs"
NEIGHBOURS = ["Norway", "United Kingdom", "Denmark", "Netherlands", "Germany", "Belgium", "Sweden", "Faroe"]

SOURCES = [
    {"id": "naturalearth", "name": "Natural Earth 1:10m — coastline, countries, bathymetry",
     "url": "https://www.naturalearthdata.com/", "licence": "Public domain",
     "attribution": "Basemap: Natural Earth", "cadence": "static"},
    {"id": "marineregions", "name": "Marine Regions — Maritime Boundaries v12 (Flanders Marine Institute)",
     "url": "https://www.marineregions.org/", "licence": "CC BY 4.0",
     "attribution": "Maritime boundaries: Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12, marineregions.org (CC BY 4.0)",
     "cadence": "with the build; the dataset changes about once a year"},
    {"id": "emodnet", "name": "EMODnet Human Activities — pipelines and platforms (Denmark, Netherlands)",
     "url": "https://emodnet.ec.europa.eu/en/human-activities", "licence": "CC BY 4.0 (EMODnet terms of use)",
     "attribution": "Danish and Dutch pipelines: EMODnet Human Activities", "cadence": "with the build"},
]


def _geojson_polys(gj):
    for f in gj["features"]:
        g = f.get("geometry") or {}
        if g.get("type") == "Polygon":
            yield f.get("properties", {}), [g["coordinates"]]
        elif g.get("type") == "MultiPolygon":
            yield f.get("properties", {}), g["coordinates"]


def _geojson_lines(gj):
    for f in gj["features"]:
        g = f.get("geometry") or {}
        if g.get("type") == "LineString":
            yield f.get("properties", {}), [g["coordinates"]]
        elif g.get("type") == "MultiLineString":
            yield f.get("properties", {}), g["coordinates"]


def natural_earth(cache: Cache, bbox, min_area_m2: float):
    """Returns coast (lines), land (list of polygons as ring lists), bathy200 (same), all clipped
    to bbox, simplified with the metric Visvalingam threshold, as lon/lat tuples."""
    x0, y0, x1, y1 = bbox

    def inside_bbox(pts):
        return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)

    coast = []
    gj = json.loads(cache.get("global/ne_10m_coastline.geojson", NE + "ne_10m_coastline.geojson"))
    for _, lines in _geojson_lines(gj):
        for line in lines:
            pts = [tuple(c[:2]) for c in line]
            if not inside_bbox(pts):
                continue
            for piece in clip_line_to_bbox(pts, bbox):
                s = simplify(piece, min_area_m2)
                if len(s) > 1:
                    coast.append(s)

    def polys_from(name, key):
        out = []
        gj = json.loads(cache.get(f"global/{name}.geojson", NE + f"{name}.geojson"))
        for props, polys in _geojson_polys(gj):
            for poly in polys:
                rings = []
                for i, ring in enumerate(poly):
                    pts = [tuple(c[:2]) for c in ring]
                    clipped = clip_polygon_to_bbox(pts, bbox)
                    if len(clipped) < 4:
                        continue
                    s = simplify(clipped, min_area_m2, closed=True)
                    if len(s) >= 4 and ring_area_m2(s) > min_area_m2:
                        rings.append(s)
                        if i == 0:
                            pass
                if rings:
                    out.append(rings)
        return out

    land = polys_from("ne_10m_admin_0_countries", "land")
    bathy = polys_from("ne_10m_bathymetry_K_200", "bathy")
    if not coast or not land:
        raise BuildError("Natural Earth: nothing inside the bbox")
    log(f"  natural earth: {len(coast)} coast pieces, {len(land)} land polygons, {len(bathy)} bathymetry polygons")
    return coast, land, bathy


def boundaries(cache: Cache, bbox, min_area_m2: float):
    quoted = ",".join(f"'{n}'" for n in NEIGHBOURS)
    cql = f"(territory1 IN ({quoted}) AND territory2 IN ({quoted}))"
    url = (VLIZ + "?" + urllib.parse.urlencode({
        "service": "WFS", "version": "1.0.0", "request": "GetFeature",
        "typeName": "MarineRegions:eez_boundaries", "outputFormat": "json", "CQL_FILTER": cql}))
    gj = json.loads(cache.get("global/eez_boundaries_north_sea.geojson", url))
    if not gj.get("features"):
        raise BuildError(f"Marine Regions returned no boundaries: {str(gj)[:200]}")
    out = []
    for props, lines in _geojson_lines(gj):
        pieces = []
        for line in lines:
            pts = [tuple(c[:2]) for c in line]
            for piece in clip_line_to_bbox(pts, bbox):
                s = simplify(piece, min_area_m2)
                if len(s) > 1:
                    pieces.append(s)
        if not pieces:
            continue
        out.append({
            "name": props.get("line_name"), "type": props.get("line_type"),
            "a": props.get("territory1"), "b": props.get("territory2"),
            "lines": pieces,
        })
    out.sort(key=lambda b: (b["name"] or "", b["type"] or ""))
    log(f"  marine regions: {len(out)} boundary lines")
    return out


def emodnet_pipelines(cache: Cache, countries: list[str], bbox):
    """EMODnet pipelines for the given ISO2 codes (their country_co attribute)."""
    quoted = ",".join(f"'{c}'" for c in countries)
    url = (EMODNET + "?" + urllib.parse.urlencode({
        "SERVICE": "WFS", "VERSION": "1.1.0", "REQUEST": "GetFeature", "typeName": "emodnet:pipelines",
        "outputFormat": "json", "CQL_FILTER": f"country_co IN ({quoted})"}))
    gj = json.loads(cache.get("global/emodnet_pipelines_" + "_".join(countries) + ".geojson", url))
    out = []
    x0, y0, x1, y1 = bbox
    for props, lines in _geojson_lines(gj):
        cc = (props.get("country_co") or "").upper()
        pts_lines = []
        for line in lines:
            pts = [tuple(c[:2]) for c in line]
            pts_lines.extend(clip_line_to_bbox(pts, bbox))
        if not pts_lines:
            continue
        size = props.get("size_in")
        try:
            dim = float(size) if size not in (None, "") else None
        except ValueError:
            dim = None
        yr = props.get("year")
        out.append({
            "id": f"{'UK' if cc == 'GB' else cc}-E{props.get('id') or len(out)}",
            "country": "UK" if cc == "GB" else cc,
            "name": (props.get("name") or "").strip() or None,
            "medium": (props.get("medium") or "").strip() or None,
            "dimIn": dim, "phase": (props.get("status") or "").strip() or None,
            "from": (props.get("from_loc") or "").strip() or None,
            "to": (props.get("to_loc") or "").strip() or None,
            "startYear": int(yr) if str(yr).isdigit() else None,
            "lines": pts_lines, "source": "emodnet",
        })
    log(f"  emodnet: {len(out)} pipelines for {countries}")
    return out
