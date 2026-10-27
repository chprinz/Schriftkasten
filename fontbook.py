#!/usr/bin/env python3
"""Legt eine Sammlung in der macOS-Schriftsammlung (Font Book) an oder ersetzt sie.

Aufruf: echo '{"name": "...", "ps": ["PostScriptName", ...]}' | python fontbook.py
Nutzt die offizielle NSFontCollection-Schnittstelle (PyObjC). Sammlungen bekommen das
Präfix "SK · ", damit eigene Sammlungen in Font Book unberührt bleiben.
"""
import json
import sys

PREFIX = "SK · "


def main():
    data = json.load(sys.stdin)
    name = (data.get("name") or "").strip()
    ps = [p for p in data.get("ps", []) if p]
    if not name or not ps:
        print(json.dumps({"ok": False, "error": "Name oder Schriften fehlen"}))
        return 1
    try:
        from AppKit import NSFontCollection, NSFontDescriptor, NSFontNameAttribute
    except Exception as e:  # noqa
        print(json.dumps({"ok": False, "error": f"PyObjC fehlt ({e}). App einmal neu starten, sie richtet es ein."}))
        return 1
    # Sichtbarkeit "User": dauerhaft gespeichert, für diesen Benutzer in allen Programmen
    VIS_USER = 1 << 1
    full = name if name.startswith(PREFIX) else PREFIX + name
    descs = [NSFontDescriptor.fontDescriptorWithFontAttributes_({NSFontNameAttribute: p}) for p in ps]
    coll = NSFontCollection.fontCollectionWithDescriptors_(descs)
    # alte Fassung entfernen (Fehler, wenn es sie nicht gibt, sind egal)
    try:
        NSFontCollection.hideFontCollectionWithName_visibility_error_(full, VIS_USER, None)
    except Exception:
        pass
    res = NSFontCollection.showFontCollection_withName_visibility_error_(coll, full, VIS_USER, None)
    ok, err = (res if isinstance(res, tuple) else (res, None))
    if not ok:
        print(json.dumps({"ok": False, "error": str(err) if err else "macOS hat die Sammlung abgelehnt"}))
        return 1
    print(json.dumps({"ok": True, "name": full, "count": len(ps)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
