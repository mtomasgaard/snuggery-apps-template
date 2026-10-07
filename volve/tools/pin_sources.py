"""Write pipeline/sources.json: every input the Volve pipeline reads, pinned.

Run once by a maintainer, never by the pipeline. For GitHub mirrors it reads the pinned commit's
tree (blob id and size), downloads each file through raw.githubusercontent.com at that commit,
checks the bytes against the blob id, and records the sha256. For the OSDU bucket and Equinor's
PDFs it records size, ETag, Last-Modified and sha256. The seismic cube is not downloaded here:
pipeline/seismic.py pins it by size and ETag and records the sha256 of the bytes it reads.

    python3 tools/pin_sources.py --cache pipeline/work/inputs
"""
import argparse
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import common  # noqa: E402

GH_API = "https://api.github.com/repos/{repo}/git/trees/{commit}?recursive=1"
RAW = "https://raw.githubusercontent.com/{repo}/{commit}/{path}"
OSDU = "https://osdu-seismic-test-data.s3.amazonaws.com/"

DECK = dict(repo="tpp-grupo-166/opm-datasets", commit="1c323c2ebafb6f92a17bcb379f4e2b9fb31ce40d", folder="volve/")
DECK_FILES = [  # VOLVE_2016.DATA and every file it INCLUDEs (the .pptx documentation is left out)
    "VOLVE_2016.DATA", "GRID_postF1B_Nov2013_locupd_12112013.grdecl", "ACTNUM_2013", "FAULT_NW_NEG.GRDECL",
    "PHIF_NW", "KLOGH_NW", "PERMZ_NW", "UH-perm-corr-main-mod13", "FLUXNUM_2013", "FAULT_NW-15NOV13.GRDECL",
    "CONTACT_MAIN-NW-AP2014.GRDECL", "FAULT_MAIN-F14-AP2014.GRDECL", "FAULT_MAIN-F12-F14-AP2014.GRDECL",
    "UH-Upflank-NW-perm-corr", "pvt_input_new_combined_PVDG_020610_perch_water_2914m.E100",
    "SOF3_NEW_PESS_2TABLES.INCL", "SGFN_NEW_BASE_2TABLES.INCL", "SWFN_NEW_PESS_C15_2TABLES.INCL", "SWIRR_NW",
    "pp03_SORW", "pp03_KRW", "PVTNUM_2013", "FIPNUM_2013", "EQLNUM_2013", "FIPNUM13_REMOVAL",
    "RSVD_input_new_combined_020610_perch_water_2914m.E100", "WELL_WSEG_TRACER_HK3_MA.SUMMARY",
    "MOD2013_VOLVE_HM_NTRANS_BASE-SHUT-DEF-F11-BHP-F12-3.SCH",
    "MOD2010_VOLVE_AMAP2012_WELLS_IOR_N_UPPERHUGIN_L-F15D.SCH", "MOD2013_VOLVE_NW-OPTIONS-SHUT-PF1C_H.SCH",
    "i_f5_7_ju.ecl", "F-12_NOV_10_TEST_2.Ecl", "SCH_010916_10DAYS.SCH",
]
RESULTS = dict(repo="f0nzie/rEcl", commit="4b187dad155f1a3f9601c0fab0536412d130accd", folder="inst/python/volve/")
RESULT_FILES = ["VOLVE_2016.SMSPEC", "VOLVE_2016.UNSMRY", "VOLVE_2016.INIT", "VOLVE_2016.RSSPEC"]
PRT = dict(repo="f0nzie/volve_eclipse_reservoir", commit="0d34eaf1be7003a6c251dea938de3e3738501d71", folder="inst/rawdata/")
PRT_FILES = ["VOLVE_2016.zip"]
FIELD = dict(repo="awgeo/Volve_field_data", commit="7cdecf1f1d24811d21bb2e2f379ff048404f4ce7", folder="input_data/")
PICKS = dict(repo="andymcdgeo/spwla_volve", commit="c293edf37c1b567b8dc9c81ea88f2cf288eab423", folder="")
PICK_FILES = ["Well_picks_Volve_v1.dat"]  # Equinor's well picks (MD, TVD, TVDSS): the wells' KB elevations
OSDU_KEYS = {
    "horizons/Hugin_Fm_Top.dat": "volve/horizons/Hugin_Fm_Top+ST10010ZC11_Near_190314_adj2_2760_EasyDC+STAT+DEPTH.dat",
    "horizons/Hugin_Fm_Base.dat": "volve/horizons/Hugin_Fm_Base+ST10010ZC11_Near_190314_adj_2999_EasyDC+STAT+DEPTH.dat",
}
SEISMIC_KEY = "volve/seismic/st0202/stacks/ST0202R08-PS_PSDM_FULL_OFFSET_DEPTH.MIG_FIN.POST_Stack.3D.JS-017534.segy"
TERMS = {
    "terms/Equinor-Terms-Volve-2020.pdf":
        "https://www.equinor.com/content/dam/statoil/documents/what-we-do/Equinor-HRS-Terms-and-conditions-for-licence-to-data-Volve.pdf",
    "terms/Equinor-Terms-Volve-blob.pdf":
        "https://equinoropendata.blob.core.windows.net/disclaimers/HRS%20and%20Terms%20and%20conditions%20for%20license%20to%20data%20-%20Volve.pdf",
}


def tree(repo, commit):
    body, _ = common.http_get(GH_API.format(repo=repo, commit=commit), headers={"Accept": "application/vnd.github+json"})
    t = json.loads(body)
    if t.get("truncated"):
        raise SystemExit(f"tree of {repo}@{commit} is truncated")
    return {e["path"]: e for e in t["tree"] if e["type"] == "blob"}


def pin_github(group, src, names, cache, local_dir):
    blobs = tree(src["repo"], src["commit"])
    out = []
    for name in names:
        path = src["folder"] + name
        if path not in blobs:
            raise SystemExit(f"{path} not in {src['repo']}@{src['commit']}")
        e = dict(group=group, path=f"{local_dir}/{name}", repo=src["repo"], commit=src["commit"], source=path,
                 url=RAW.format(repo=src["repo"], commit=src["commit"], path=urllib.parse.quote(path)),
                 bytes=blobs[path]["size"], gitBlob=blobs[path]["sha"])
        dest = Path(cache) / e["path"]
        if not dest.exists() or common.git_blob_sha1(dest) != e["gitBlob"]:
            _download_unpinned(e, dest)
        if common.git_blob_sha1(dest) != e["gitBlob"]:
            raise SystemExit(f"{path}: downloaded bytes do not match the commit's blob {e['gitBlob']}")
        e["sha256"] = common.sha256_file(dest)
        out.append(e)
        print(f"{e['bytes']:>11,}  {e['sha256'][:16]}  {e['path']}")
    return out


def _download_unpinned(e, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    body, _ = common.http_get(e["url"], timeout=600)
    if len(body) != e["bytes"]:
        raise SystemExit(f"{e['url']}: {len(body)} B, the tree says {e['bytes']}")
    dest.write_bytes(body)


def pin_url(group, local, url, cache):
    h = common.http_head(url)
    dest = Path(cache) / local
    dest.parent.mkdir(parents=True, exist_ok=True)
    body, _ = common.http_get(url, timeout=600)
    dest.write_bytes(body)
    e = dict(group=group, path=local, url=url, bytes=len(body), sha256=common.sha256_file(dest),
             etag=h.get("ETag", "").strip('"'), lastModified=h.get("Last-Modified", ""))
    if int(h.get("Content-Length", len(body))) != len(body):
        raise SystemExit(f"{url}: HEAD and GET disagree on size")
    print(f"{e['bytes']:>11,}  {e['sha256'][:16]}  {e['path']}")
    return e


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", default=str(common.HERE / "work" / "inputs"))
    ap.add_argument("--only", choices=["deck", "results", "prt", "field", "osdu", "terms", "seismic"], action="append")
    args = ap.parse_args()
    groups = set(args.only or ["deck", "results", "prt", "field", "osdu", "terms", "seismic"])
    old = common.load_sources() if common.SOURCES.exists() else {"files": [], "seismic": {}}
    files = [f for f in old.get("files", []) if f["group"] not in groups]
    if "deck" in groups:
        files += pin_github("deck", DECK, DECK_FILES, args.cache, "deck")
    if "results" in groups:
        files += pin_github("results", RESULTS, RESULT_FILES, args.cache, "equinor")
    if "prt" in groups:
        files += pin_github("prt", PRT, PRT_FILES, args.cache, "equinor")
    if "field" in groups:
        blobs = tree(FIELD["repo"], FIELD["commit"])
        names = ["Volve production data.xlsx"] + sorted(
            p[len(FIELD["folder"]):] for p in blobs if p.startswith(FIELD["folder"] + "wellpaths/") and "ACTUAL" in p)
        files += pin_github("field", FIELD, names, args.cache, "field")
        files += pin_github("field", PICKS, PICK_FILES, args.cache, "field")
    if "osdu" in groups:
        for local, key in OSDU_KEYS.items():
            files.append(pin_url("osdu", local, OSDU + urllib.parse.quote(key), args.cache))
    if "terms" in groups:
        for local, url in TERMS.items():
            files.append(pin_url("terms", local, url, args.cache))
    seismic = old.get("seismic", {})
    if "seismic" in groups:
        url = OSDU + urllib.parse.quote(SEISMIC_KEY)
        h = common.http_head(url)
        seismic = dict(url=url, key=SEISMIC_KEY, bytes=int(h["Content-Length"]), etag=h["ETag"].strip('"'),
                       lastModified=h["Last-Modified"], **{k: v for k, v in seismic.items() if k.startswith("read")})
        print(f"{seismic['bytes']:>11,}  etag {seismic['etag']}  {SEISMIC_KEY}")
    order = ["deck", "results", "prt", "field", "osdu", "terms"]
    files.sort(key=lambda f: (order.index(f["group"]), f["path"]))
    common.SOURCES.write_text(json.dumps({"files": files, "seismic": seismic}, indent=1) + "\n")
    print(f"wrote {common.SOURCES} ({len(files)} files)")


if __name__ == "__main__":
    main()
