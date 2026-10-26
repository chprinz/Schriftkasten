#!/usr/bin/env python3
"""Schriftkasten: kleiner lokaler Server für die Schriften-Oberfläche.

Läuft nur auf 127.0.0.1. Liefert die Oberfläche, den Katalog und die Schriftdateien
für die Vorschau, speichert Sammlungen/Notizen in data/userdata.json und kann
Schriften installieren (Kopie nach ~/Library/Fonts) oder ins Archiv verschieben.
"""
import argparse
import io
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
DATA = Path(os.environ["SK_DATA"]) if os.environ.get("SK_DATA") else HERE / "data"
CATALOG = DATA / "catalog.json"
USERDATA = DATA / "userdata.json"
CURATED = HERE / "curated.json"
TTC_CACHE = DATA / "ttc-cache"
HOME = Path.home()
USER_FONTS = HOME / "Library/Fonts"

FONT_TYPES = {
    "ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2",
    "ttc": "font/ttf", "otc": "font/otf", "dfont": "application/octet-stream",
}

APP_VERSION = "1.2"
_lock = threading.Lock()
_last_seen = [time.time()]
IDLE_HOURS = float(os.environ.get("SK_IDLE_HOURS", "8"))
_catalog = {"mtime": 0, "data": None}


def load_catalog():
    if not CATALOG.exists():
        return None
    m = CATALOG.stat().st_mtime
    if _catalog["mtime"] != m:
        _catalog["data"] = json.loads(CATALOG.read_text("utf-8"))
        _catalog["mtime"] = m
    return _catalog["data"]


def archive_dir():
    cfg = DATA / "config.json"
    if not cfg.exists():
        cfg = HERE / "config.json"
    d = "~/Schriften-Archiv"
    if cfg.exists():
        try:
            d = json.loads(cfg.read_text("utf-8")).get("archiveDir", d)
        except Exception:
            pass
    return Path(os.path.expanduser(d))


def face_path(face_id):
    cat = load_catalog()
    if not cat:
        return None, None
    face = cat["faces"].get(face_id)
    if not face:
        return None, None
    src = next((s for s in cat["sources"] if s["id"] == face["src"]), None)
    if not src:
        return None, None
    root = Path(src["path"]).resolve()
    p = (root / face["rel"]).resolve()
    if root not in p.parents and p != root:
        return None, None
    return p, face


def ttc_face_bytes(path, idx, face_id):
    TTC_CACHE.mkdir(parents=True, exist_ok=True)
    out = TTC_CACHE / f"{face_id}.ttf"
    if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
        return out.read_bytes()
    from fontTools.ttLib import TTFont
    f = TTFont(str(path), fontNumber=idx or 0)
    buf = io.BytesIO()
    f.save(buf)
    out.write_bytes(buf.getvalue())
    return buf.getvalue()


def initial_userdata():
    base = {"version": 1, "collections": [], "families": {}, "settings": {}}
    if CURATED.exists():
        try:
            cur = json.loads(CURATED.read_text("utf-8"))
            # Nur die Sammlungen werden übernommen. Kategorien und Notizen aus curated.json
            # bleiben eine Vorgabe-Ebene, damit spätere Updates davon greifen.
            base["collections"] = cur.get("collections", [])
        except Exception as e:
            print("curated.json nicht lesbar:", e)
    return base


def run_scan():
    py = sys.executable
    r = subprocess.run([py, str(HERE / "scan.py")], capture_output=True, text=True, cwd=str(HERE))
    return r.returncode, (r.stdout + r.stderr)[-4000:]


class Handler(BaseHTTPRequestHandler):
    server_version = "Schriftkasten/1"

    def log_message(self, fmt, *args):
        if os.environ.get("SK_DEBUG"):
            super().log_message(fmt, *args)

    # -- Hilfen
    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json; charset=utf-8", cache=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache or "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # -- GET
    def do_GET(self):
        if not self._host_ok():
            return self._send(403, {"error": "nur lokal"})
        path = unquote(urlparse(self.path).path)
        _last_seen[0] = time.time()
        if path == "/api/ping":
            return self._send(200, {"app": "schriftkasten", "version": APP_VERSION, "pid": os.getpid()})
        if path in ("/", "/index.html"):
            return self._static(WEB / "index.html")
        if path.startswith("/web/"):
            return self._static(WEB / path[5:])
        if path == "/api/catalog":
            cat = load_catalog()
            if cat is None:
                return self._send(404, {"error": "Noch kein Katalog. Bitte einlesen."})
            return self._static(CATALOG, "application/json; charset=utf-8")
        if path == "/api/userdata":
            with _lock:
                if not USERDATA.exists():
                    DATA.mkdir(parents=True, exist_ok=True)
                    USERDATA.write_text(json.dumps(initial_userdata(), ensure_ascii=False, indent=1), "utf-8")
                return self._static(USERDATA, "application/json; charset=utf-8")
        if path == "/api/curated":
            if CURATED.exists():
                return self._static(CURATED, "application/json; charset=utf-8")
            return self._send(200, {})
        if path.startswith("/font/"):
            fid = path[6:].split(".")[0]
            p, face = face_path(fid)
            if not p or not p.exists():
                return self._send(404, {"error": "Schrift nicht gefunden"})
            try:
                if face["fmt"] in ("ttc", "otc", "dfont"):
                    data = ttc_face_bytes(p, face.get("idx"), fid)
                    ctype = "font/ttf"
                else:
                    data = p.read_bytes()
                    ctype = FONT_TYPES.get(face["fmt"], "application/octet-stream")
            except Exception as e:
                return self._send(500, {"error": str(e)})
            return self._send(200, data, ctype, cache="private, max-age=86400")
        return self._send(404, {"error": "unbekannt"})

    def _static(self, p, ctype=None):
        p = Path(p).resolve()
        roots = [HERE.resolve(), DATA.resolve()]
        if not any(r == p or r in p.parents for r in roots) or not p.is_file():
            return self._send(404, {"error": "nicht gefunden"})
        ctype = ctype or (mimetypes.guess_type(str(p))[0] or "application/octet-stream")
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        return self._send(200, p.read_bytes(), ctype)

    # -- POST/PUT: nur mit eigenem Header (blockiert fremde Webseiten)
    def _guard(self):
        if not self._host_ok() or self.headers.get("X-Schriftkasten") != "1":
            self._send(403, {"error": "verboten"})
            return False
        return True

    def do_PUT(self):
        if not self._guard():
            return
        if urlparse(self.path).path == "/api/userdata":
            data = self._json_body()
            with _lock:
                tmp = USERDATA.with_suffix(".tmp")
                tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")
                if USERDATA.exists():
                    shutil.copy2(USERDATA, USERDATA.with_suffix(".bak.json"))
                os.replace(tmp, USERDATA)
            return self._send(200, {"ok": True})
        return self._send(404, {"error": "unbekannt"})

    def do_POST(self):
        if not self._guard():
            return
        path = urlparse(self.path).path
        body = self._json_body()
        if path == "/api/quit":
            self._send(200, {"ok": True})
            threading.Timer(0.3, lambda: os._exit(0)).start()
            return
        if path == "/api/rescan":
            code, out = run_scan()
            return self._send(200 if code == 0 else 500, {"ok": code == 0, "log": out})
        if path == "/api/reveal":
            p, _ = face_path(body.get("faceId", ""))
            if not p:
                return self._send(404, {"error": "nicht gefunden"})
            if sys.platform == "darwin":
                subprocess.run(["open", "-R", str(p)])
            return self._send(200, {"ok": True, "path": str(p)})
        if path == "/api/install":
            return self._install(body.get("faceIds", []))
        if path == "/api/archive":
            return self._archive(body.get("faceIds", []))
        return self._send(404, {"error": "unbekannt"})

    def _install(self, ids):
        done, skipped = [], []
        seen = set()
        for fid in ids:
            p, face = face_path(fid)
            if not p or str(p) in seen:
                continue
            seen.add(str(p))
            if face.get("installed"):
                skipped.append({"file": p.name, "why": "schon installiert"})
                continue
            target = USER_FONTS / p.name
            if target.exists():
                skipped.append({"file": p.name, "why": "gleichnamige Datei liegt schon in ~/Library/Fonts"})
                continue
            if face["src"] == "archiv":
                shutil.move(str(p), str(target))
            else:
                shutil.copy2(str(p), str(target))
            done.append(p.name)
        code, log = run_scan() if done else (0, "")
        return self._send(200, {"ok": True, "installed": done, "skipped": skipped, "log": log})

    def _archive(self, ids):
        arch = archive_dir()
        done, skipped = [], []
        seen = set()
        for fid in ids:
            p, face = face_path(fid)
            if not p or str(p) in seen:
                continue
            seen.add(str(p))
            if face["src"] != "user":
                skipped.append({"file": p.name, "why": "nur Schriften aus ~/Library/Fonts lassen sich hier aussortieren"})
                continue
            arch.mkdir(parents=True, exist_ok=True)
            target = arch / p.name
            if target.exists():
                stem, suf = os.path.splitext(p.name)
                target = arch / f"{stem} ({time.strftime('%Y%m%d-%H%M%S')}){suf}"
            shutil.move(str(p), str(target))
            done.append(p.name)
        code, log = run_scan() if done else (0, "")
        return self._send(200, {"ok": True, "archived": done, "skipped": skipped, "archiveDir": str(arch), "log": log})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("SK_PORT", 8737)))
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--scan", action="store_true", help="vor dem Start Änderungen einlesen")
    args = ap.parse_args()
    if args.scan or not CATALOG.exists():
        print("Lese Schriften ein …")
        code, out = run_scan()
        print(out)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Schriftkasten läuft: {url}  (Beenden mit ctrl-c)")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    def idle_watch():
        while True:
            time.sleep(300)
            if IDLE_HOURS > 0 and time.time() - _last_seen[0] > IDLE_HOURS * 3600:
                print("Länger nicht benutzt, beende.")
                os._exit(0)
    threading.Thread(target=idle_watch, daemon=True).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nBeendet.")


if __name__ == "__main__":
    main()
