#!/usr/bin/env python3
"""Schriftkasten: liest alle Schriftquellen ein und schreibt data/catalog.json.

Quellen (automatisch, sofern vorhanden):
  user      ~/Library/Fonts                         installiert
  local     /Library/Fonts                          installiert
  adobe     Adobe CoreSync (aktivierte Adobe Fonts)  installiert
  fontbase  ~/FontBase                              Bibliothek, nicht aktiv
  archiv    ~/Schriften-Archiv                      aussortiert
  system    /System/Library/Fonts (nur mit --system)

Weitere Ordner: in config.json unter "extraSources" eintragen.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import logging
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from fontTools.ttLib import TTFont, TTCollection
except ImportError:
    sys.exit("fontTools fehlt. Bitte ./schriftkasten starten (richtet alles ein) oder: pip3 install fonttools brotli")

logging.getLogger("fontTools").setLevel(logging.ERROR)

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
HOME = Path.home()
CACHE_VERSION = 3
FONT_EXT = {".ttf", ".otf", ".ttc", ".otc", ".woff", ".woff2", ".dfont"}
ADOBE_BASE = HOME / "Library/Application Support/Adobe/CoreSync/plugins/livetype"

TRIAL_NAME_RE = re.compile(r"\b(trial|demo|personal[\s_-]*use)\b", re.I)
TRIAL_LIC_RE = re.compile(r"(personal use only|for personal use|non[\s-]*commercial use|not for commercial|nur f(ü|ue)r (den )?privat)", re.I)
COMMERCIAL_OK_RE = re.compile(r"(personal and commercial|commercial and personal|commercial use (is )?(allowed|permitted|free))", re.I)
OFL_RE = re.compile(r"(open font license|openfontlicense|scripts\.sil\.org/ofl|\bOFL\b)", re.I)
APACHE_RE = re.compile(r"apache license", re.I)
UFL_RE = re.compile(r"ubuntu font licen", re.I)

DE_CHARS = "äöüÄÖÜß"
QUOTES_DE = "„“‚‘»«"
LATIN_EXT_A = range(0x0100, 0x0180)
CYR = range(0x0410, 0x0450)
GREEK = range(0x0391, 0x03CA)


def load_config():
    cfg_path = HERE / "config.json"
    if cfg_path.exists():
        try:
            return json.loads(cfg_path.read_text("utf-8"))
        except Exception as e:  # noqa
            print(f"config.json nicht lesbar: {e}")
    return {}


def default_sources(cfg, include_system=False):
    archive = Path(os.path.expanduser(cfg.get("archiveDir", "~/Schriften-Archiv")))
    src = [
        {"id": "user", "label": "Meine Schriften", "path": str(HOME / "Library/Fonts"), "installed": True},
        {"id": "local", "label": "Alle Benutzer", "path": "/Library/Fonts", "installed": True},
        {"id": "adobe", "label": "Adobe Fonts", "path": str(ADOBE_BASE / ".r"), "installed": True, "hidden": True},
        {"id": "fontbase", "label": "FontBase-Bibliothek", "path": str(HOME / "FontBase"), "installed": False},
        {"id": "archiv", "label": "Archiv", "path": str(archive), "installed": False},
    ]
    if include_system or cfg.get("includeSystem"):
        src.append({"id": "system", "label": "macOS System", "path": "/System/Library/Fonts", "installed": True})
    for i, extra in enumerate(cfg.get("extraSources", [])):
        src.append({
            "id": extra.get("id") or f"extra{i+1}",
            "label": extra.get("label") or Path(extra["path"]).name,
            "path": os.path.expanduser(extra["path"]),
            "installed": bool(extra.get("installed", False)),
        })
    return src


def name_of(font, *ids):
    tbl = font["name"] if "name" in font else None
    if not tbl:
        return ""
    for nid in ids:
        rec = tbl.getName(nid, 3, 1, 0x409) or tbl.getName(nid, 1, 0, 0)
        if rec is None:
            for r in tbl.names:
                if r.nameID == nid:
                    rec = r
                    break
        if rec is not None:
            try:
                s = rec.toUnicode().strip()
            except Exception:
                s = str(rec).strip()
            if s:
                return s
    return ""


def adobe_entitlements():
    """Liest entitlements.xml generisch: jedes Element mit <id>-Kind wird zu einem Eintrag."""
    out = {}
    xml = ADOBE_BASE / "c/entitlements.xml"
    if not xml.exists():
        return out
    try:
        root = ET.parse(xml).getroot()
    except Exception as e:
        print(f"  Adobe entitlements.xml nicht lesbar: {e}")
        return out
    for el in root.iter():
        kids = list(el)
        if not kids:
            continue
        d = {}
        for k in kids:
            if len(k) == 0 and k.text and k.text.strip():
                d[k.tag] = k.text.strip()
        # Eigenschaften stecken je nach Version auch in <properties>
        props = el.find("properties")
        if props is not None:
            for k in props:
                if k.text and k.text.strip():
                    d[k.tag] = k.text.strip()
        if "id" in d and any(t in d for t in ("familyName", "fullName", "postscriptName", "familyURLName")):
            out[d["id"]] = d
    return out


def classify(font, family, style, panose_family, panose_serif, fixed):
    n = f"{family} {style}".lower()
    if fixed or re.search(r"\bmono|\bcode\b|typewriter", n):
        return "mono"
    if panose_family == 3 or re.search(r"script|hand|brush|signature|marker|calligra|written|\bpen\b", n):
        return "handwriting"
    if panose_family == 4 or re.search(r"display|poster|stencil|inline|shadow|outline|decor|grunge", n):
        return "display"
    if re.search(r"slab", n) or panose_serif == 6:
        return "slab"
    if re.search(r"sans|grotesk|grotesque|gothic|\bgrot", n):
        return "sans"
    if re.search(r"serif|antiqua|roman\b|garamond|caslon|baskerville|didot|bodoni", n):
        return "serif"
    if panose_family == 2:
        if 2 <= panose_serif <= 10:
            return "serif"
        if 11 <= panose_serif <= 15:
            return "sans"
    return ""


def analyse_face(font, path, index, src, adobe_meta):
    family = name_of(font, 16, 1)
    style = name_of(font, 17, 2) or "Regular"
    ps = name_of(font, 6)
    os2 = font["OS/2"] if "OS/2" in font else None
    head = font["head"] if "head" in font else None
    post = font["post"] if "post" in font else None
    cmap = font.getBestCmap() or {}
    cps = set(cmap.keys())

    weight = getattr(os2, "usWeightClass", 400) if os2 else 400
    width = getattr(os2, "usWidthClass", 5) if os2 else 5
    fs_sel = getattr(os2, "fsSelection", 0) if os2 else 0
    italic = bool(fs_sel & 1) or bool(head and head.macStyle & 2) or bool(re.search(r"italic|oblique|kursiv", style, re.I))
    pan = getattr(os2, "panose", None) if os2 else None
    pan_fam = getattr(pan, "bFamilyType", 0) if pan else 0
    pan_serif = getattr(pan, "bSerifStyle", 0) if pan else 0
    fixed = bool(post and post.isFixedPitch)
    upm = head.unitsPerEm if head else 1000
    xh = getattr(os2, "sxHeight", 0) if os2 and os2.version >= 2 else 0
    ch = getattr(os2, "sCapHeight", 0) if os2 and os2.version >= 2 else 0
    vendor = (getattr(os2, "achVendID", "") or "").strip() if os2 else ""

    axes, instances = [], []
    if "fvar" in font:
        for a in font["fvar"].axes:
            axes.append({"tag": a.axisTag, "min": a.minValue, "def": a.defaultValue, "max": a.maxValue})
        for inst in font["fvar"].instances:
            nm = font["name"].getDebugName(inst.subfamilyNameID) if "name" in font else ""
            instances.append({"name": nm or "", "coords": {k: round(v, 2) for k, v in inst.coordinates.items()}})

    if axes:
        # Variable Fonts: Standardinstanz ist oft Black o. Ä.; für Auswahl und Anzeige zählt Regular
        wa = next((a for a in axes if a["tag"] == "wght"), None)
        if wa:
            weight = int(min(max(400, wa["min"]), wa["max"]))
        style = "Variabel" + (" Kursiv" if italic else "")

    feats = set()
    for t in ("GSUB", "GPOS"):
        if t in font and getattr(font[t].table, "FeatureList", None):
            for fr in font[t].table.FeatureList.FeatureRecord:
                feats.add(fr.FeatureTag)
    if "kern" in font:
        feats.add("kern")

    lic = name_of(font, 13)
    lic_url = name_of(font, 14)
    copyright_ = name_of(font, 0)
    name_blob = " ".join([family, style, ps, os.path.basename(path)])
    trial = bool(TRIAL_NAME_RE.search(name_blob)) or (bool(TRIAL_LIC_RE.search(lic)) and not COMMERCIAL_OK_RE.search(lic))

    face = {
        "src": src["id"],
        "rel": os.path.relpath(path, src["path"]),
        "idx": index,
        "family": family,
        "style": style,
        "full": name_of(font, 4),
        "ps": ps,
        "version": name_of(font, 5).replace("Version ", "").split(";")[0].strip()[:24],
        "designer": name_of(font, 9)[:120],
        "foundry": name_of(font, 8)[:120],
        "vendor": vendor,
        "designerUrl": name_of(font, 12)[:200],
        "vendorUrl": name_of(font, 11)[:200],
        "license": lic[:600],
        "licenseUrl": lic_url[:200],
        "copyright": copyright_[:300],
        "weight": weight,
        "width": width,
        "italic": italic,
        "fixed": fixed,
        "panose": [pan_fam, pan_serif],
        "upm": upm,
        "xh": round(xh / upm, 3) if xh else None,
        "cap": round(ch / upm, 3) if ch else None,
        "glyphs": len(font.getGlyphOrder()),
        "axes": axes,
        "instances": instances,
        "features": sorted(feats),
        "de": all(ord(c) in cps for c in DE_CHARS),
        "capSharpS": 0x1E9E in cps,
        "quotesDe": all(ord(c) in cps for c in QUOTES_DE),
        "euro": 0x20AC in cps,
        "latinExt": round(sum(1 for c in LATIN_EXT_A if c in cps) / len(LATIN_EXT_A), 2),
        "cyrillic": sum(1 for c in CYR if c in cps) > 50,
        "greek": sum(1 for c in GREEK if c in cps) > 40,
        "lowercase": all(c in cps for c in range(0x61, 0x7B)),
        "trial": trial,
        "licType": "OFL" if OFL_RE.search(lic + " " + lic_url) else "Apache" if APACHE_RE.search(lic) else "UFL" if UFL_RE.search(lic) else "",
        "guess": classify(font, family, style, pan_fam, pan_serif, fixed),
    }
    if src["id"] == "adobe":
        face["licType"] = "Adobe Fonts"
        fid = re.sub(r"\D", "", os.path.basename(path))
        if fid in adobe_meta:
            m = adobe_meta[fid]
            face["adobe"] = {k: m[k] for k in ("familyName", "familyURLName", "fullName", "foundryName", "variationName") if k in m}
    return face


def file_hash(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def iter_files(root, hidden):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if hidden or not d.startswith(".")]
        for fn in filenames:
            if not hidden and fn.startswith("."):
                continue
            p = os.path.join(dirpath, fn)
            ext = os.path.splitext(fn)[1].lower()
            if ext in FONT_EXT or (hidden and ext in {".otf", ".ttf", ""}):
                yield p, ext
            elif ext in {".eot", ".pfb", ".pfm", ".afm", ".bdf", ".fon", ".fnt", ".suit"}:
                yield p, ext  # nur als "nicht nutzbar" melden


def scan(sources, cache):
    faces, problems, srcinfo = [], [], []
    adobe_meta = adobe_entitlements()
    new_cache = {}
    for src in sources:
        root = src["path"]
        info = {k: src[k] for k in ("id", "label", "path", "installed")}
        if not os.path.isdir(root):
            info.update(ok=False, files=0, faces=0)
            srcinfo.append(info)
            continue
        nfiles = nfaces = 0
        t0 = time.time()
        for path, ext in iter_files(root, src.get("hidden", False)):
            nfiles += 1
            rel = os.path.relpath(path, root)
            if ext in {".eot", ".pfb", ".pfm", ".afm", ".bdf", ".fon", ".fnt", ".suit"}:
                problems.append({"src": src["id"], "rel": rel, "issue": f"Format {ext} wird von modernen Programmen kaum noch unterstützt"})
                continue
            try:
                st = os.stat(path)
            except OSError:
                continue
            key = f"{src['id']}:{rel}"
            sig = f"{st.st_size}:{int(st.st_mtime)}"
            cached = cache.get(key)
            if cached and cached.get("sig") == sig:
                entry = cached
            else:
                entry = {"sig": sig, "faces": [], "error": None}
                try:
                    entry["hash"] = file_hash(path)
                    if ext in {".ttc", ".otc"}:
                        coll = TTCollection(path, lazy=True)
                        for idx, f in enumerate(coll.fonts):
                            entry["faces"].append(analyse_face(f, path, idx, src, adobe_meta))
                        coll.close()
                    else:
                        f = TTFont(path, lazy=True, fontNumber=0)
                        entry["faces"].append(analyse_face(f, path, None, src, adobe_meta))
                        f.close()
                except Exception as e:
                    entry["error"] = f"{type(e).__name__}: {e}"[:200]
            new_cache[key] = entry
            if entry.get("error"):
                problems.append({"src": src["id"], "rel": rel, "issue": "Datei nicht lesbar: " + entry["error"]})
                continue
            for fc in entry["faces"]:
                fc = dict(fc)
                fc["size"] = st.st_size
                fc["mtime"] = int(st.st_mtime)
                fc["hash"] = entry.get("hash")
                fc["fmt"] = ext.lstrip(".") or "otf"
                fc["id"] = hashlib.sha1(f"{key}#{fc['idx']}".encode()).hexdigest()[:12]
                fc["installed"] = src["installed"]
                faces.append(fc)
                nfaces += 1
        info.update(ok=True, files=nfiles, faces=nfaces, secs=round(time.time() - t0, 1))
        print(f"  {src['label']:<22} {nfiles:>5} Dateien  {nfaces:>5} Schnitte  ({info['secs']} s)")
        srcinfo.append(info)
    return faces, problems, srcinfo, new_cache


STYLE_WORDS = r"(thin|hairline|extra ?light|ultra ?light|light|book|normal|regular|roman|medium|semi ?bold|demi ?bold|bold|extra ?bold|ultra ?bold|heavy|black|ultra ?black|fat|italic|oblique|\d{3})"
TRAIL_RE = re.compile(r"(?:[\s_-]+" + STYLE_WORDS + r")+$", re.I)


def clean_family(name):
    """Entfernt Schnittbezeichnungen, die ältere Schriften in den Familiennamen packen."""
    n = re.sub(r"[_]+", " ", name).strip()
    n = re.sub(r"\b(trial|demo|personal use( only)?)\b", "", n, flags=re.I).strip(" -")
    stripped = TRAIL_RE.sub("", n).strip(" -")
    return stripped or n


def norm_family(name):
    n = clean_family(name).lower().replace("-", " ")
    return re.sub(r"\s+", " ", n).strip()


def build_families(faces, gf):
    fams = {}
    for f in faces:
        if f["family"].lower() in gf:
            key = f["family"].lower()
        else:
            key = norm_family(f["family"]) or norm_family(f["ps"]) or f["id"]
        fam = fams.setdefault(key, {"key": key, "names": {}, "faces": []})
        disp = f["family"] if f["family"].lower() in gf else clean_family(f["family"])
        fam["names"][disp] = fam["names"].get(disp, 0) + 1
        fam["faces"].append(f)

    out = []
    for key, fam in fams.items():
        fs = fam["faces"]
        name = max(fam["names"].items(), key=lambda kv: kv[1])[0]
        gfm = gf.get(name.lower()) or gf.get(key)
        # Duplikate: gleiche PS-Namen aus mehreren Dateien
        by_ps = {}
        for f in fs:
            if not f["installed"]:
                continue
            by_ps.setdefault((f["ps"] or f["full"] or f["style"]).lower(), []).append(f)
        dups = [[x["id"] for x in v] for v in by_ps.values() if len(v) > 1]
        installed_faces = [f for f in fs if f["installed"]]
        weights = sorted({f["weight"] for f in fs if not f["axes"]})
        var_w = [a for f in fs for a in f["axes"] if a["tag"] == "wght"]
        wmin = min([w for w in weights] + [a["min"] for a in var_w]) if (weights or var_w) else 400
        wmax = max([w for w in weights] + [a["max"] for a in var_w]) if (weights or var_w) else 400
        n_weights = len(weights) + (int((max(a["max"] for a in var_w) - min(a["min"] for a in var_w)) / 100) + 1 if var_w else 0)
        has_italic = any(f["italic"] for f in fs) or any(a["tag"] in ("ital", "slnt") for f in fs for a in f["axes"])
        variable = any(f["axes"] for f in fs)
        feats = sorted(set().union(*[set(f["features"]) for f in fs]))
        de = all(f["de"] for f in fs)
        trial = any(f["trial"] for f in fs)
        latin_ext = min(f["latinExt"] for f in fs)
        lowercase = any(f["lowercase"] for f in fs)

        if gfm:
            cat = {"SANS_SERIF": "sans", "SERIF": "serif", "DISPLAY": "display", "HANDWRITING": "handwriting", "MONOSPACE": "mono"}.get(gfm["c"], "")
            if cat == "serif" and gfm.get("s") == "SLAB_SERIF":
                cat = "slab"
        else:
            guesses = [f["guess"] for f in fs if f["guess"]]
            cat = max(set(guesses), key=guesses.count) if guesses else ""

        # Qualitäts-Punkte
        score = 0
        score += min(n_weights, 9) / 9 * 30
        score += 15 if has_italic else 0
        score += 15 if de else 0
        score += 10 * latin_ext
        good_feats = {"kern", "liga", "tnum", "lnum", "onum", "pnum", "smcp", "c2sc", "case", "frac", "sups", "ss01", "calt", "zero"}
        score += min(len(good_feats & set(feats)), 8) / 8 * 15
        score += 10 if (gfm or any(f["src"] == "adobe" for f in fs) or any(f["licType"] for f in fs)) else 0
        score += 5 if max(f["glyphs"] for f in fs) >= 400 else 0
        if trial:
            score = min(score, 20)
        if not de:
            score = min(score, 35)
        score = round(score)

        if trial:
            tier = "eingeschraenkt"
        elif not de or not lowercase:
            tier = "eingeschraenkt"
        elif cat in ("display", "handwriting"):
            tier = "charakter"
        elif score >= 62:
            tier = "solide"
        elif score >= 40:
            tier = "brauchbar"
        else:
            tier = "einfach"

        designer = next((f["designer"] for f in fs if f["designer"]), "") or (gfm or {}).get("d", "")
        foundry = next((f["foundry"] for f in fs if f["foundry"]), "")
        lic_types = sorted({f["licType"] for f in fs if f["licType"]})
        if gfm and not lic_types:
            lic_types = [{"ofl": "OFL", "apache": "Apache", "ufl": "UFL"}.get(gfm["l"], "OFL")]
        # Darstellungs-Schnitt: Regular bevorzugen
        def rank(f):
            return (f["italic"], abs(f["weight"] - 400), 0 if f["installed"] else 1, f["fmt"] != "otf")
        rep = sorted(fs, key=rank)[0]
        faces_sorted = sorted(fs, key=lambda f: (f["width"], f["italic"], f["weight"], f["style"]))
        out.append({
            "key": key,
            "name": name,
            "cat": cat,
            "tier": tier,
            "score": score,
            "faceIds": [f["id"] for f in faces_sorted],
            "rep": rep["id"],
            "nStyles": len({(f["ps"] or f["style"]).lower() for f in fs}),
            "nWeights": n_weights,
            "wmin": wmin,
            "wmax": wmax,
            "italic": has_italic,
            "variable": variable,
            "de": de,
            "capSharpS": any(f["capSharpS"] for f in fs),
            "quotesDe": all(f["quotesDe"] for f in fs),
            "latinExt": latin_ext,
            "cyrillic": any(f["cyrillic"] for f in fs),
            "greek": any(f["greek"] for f in fs),
            "features": feats,
            "trial": trial,
            "srcs": sorted({f["src"] for f in fs}),
            "installed": len({(f["ps"] or f["style"]).lower() for f in installed_faces}),
            "dups": dups,
            "designer": designer,
            "foundry": foundry,
            "lic": lic_types,
            "google": bool(gfm),
            "gfYear": (gfm or {}).get("a", ""),
            "adobeUrl": next((f["adobe"]["familyURLName"] for f in fs if f.get("adobe", {}).get("familyURLName")), ""),
            "added": max(f["mtime"] for f in fs),
            "xh": next((f["xh"] for f in [rep] + fs if f["xh"]), None),
            "fmts": sorted({f["fmt"] for f in fs}),
        })
    out.sort(key=lambda f: f["name"].lower())
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--system", action="store_true", help="auch macOS-Systemschriften einlesen")
    ap.add_argument("--full", action="store_true", help="Zwischenspeicher ignorieren, alles neu lesen")
    ap.add_argument("--source", action="append", default=[], metavar="ID=PFAD", help="Quelle überschreiben/ergänzen (zum Testen)")
    ap.add_argument("--only", help="nur diese Quellen-IDs (Komma-getrennt)")
    args = ap.parse_args()

    cfg = load_config()
    sources = default_sources(cfg, args.system)
    for s in args.source:
        sid, _, p = s.partition("=")
        hit = next((x for x in sources if x["id"] == sid), None)
        if hit:
            hit["path"] = p
        else:
            sources.append({"id": sid, "label": sid, "path": p, "installed": False})
    if args.only:
        keep = set(args.only.split(","))
        sources = [s for s in sources if s["id"] in keep]

    DATA.mkdir(exist_ok=True)
    cache_path = DATA / "scan-cache.json"
    cache = {}
    if cache_path.exists() and not args.full:
        try:
            cache = json.loads(cache_path.read_text("utf-8"))
            if cache.get("_v") != CACHE_VERSION:
                cache = {}
        except Exception:
            cache = {}
    gf_path = DATA / "google-fonts-meta.json"
    gf = json.loads(gf_path.read_text("utf-8")) if gf_path.exists() else {}

    print("Schriftkasten liest Schriften ein …")
    t0 = time.time()
    faces, problems, srcinfo, new_cache = scan(sources, cache)
    families = build_families(faces, gf)

    # Dateien mit identischem Inhalt an mehreren Orten
    by_hash = {}
    for f in faces:
        by_hash.setdefault((f["hash"], f["idx"]), []).append(f["id"])
    same_files = [v for v in by_hash.values() if len(v) > 1]

    catalog = {
        "generated": int(time.time()),
        "host": os.uname().nodename,
        "sources": srcinfo,
        "families": families,
        "faces": {f["id"]: f for f in faces},
        "problems": problems,
        "identicalFiles": same_files,
    }
    (DATA / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), "utf-8")
    new_cache["_v"] = CACHE_VERSION
    cache_path.write_text(json.dumps(new_cache, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tiers = {}
    for f in families:
        tiers[f["tier"]] = tiers.get(f["tier"], 0) + 1
    print(f"Fertig in {time.time()-t0:.1f} s: {len(families)} Familien, {len(faces)} Schnitte, {len(problems)} Hinweise.")
    print("  " + ", ".join(f"{k}: {v}" for k, v in sorted(tiers.items())))


if __name__ == "__main__":
    main()
