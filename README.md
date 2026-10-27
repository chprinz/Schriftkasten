# Schriftkasten

Ein lokales Werkzeug, um die eigenen Schriften zu finden, zu vergleichen und zu ordnen. Es liest alle Schriftordner am Mac ein, zeigt jede Familie mit echter Vorschau im Browser und merkt sich Sammlungen, Bewertungen, Tags und Notizen.

Kein Abo, keine Cloud, kein Konto. Alles bleibt auf dem Rechner.

## Starten

**Als App:** `Schriftkasten.app` in `~/Applications` doppelklicken, oder das Symbol ins Dock ziehen. Die App startet einen kleinen Dienst im Hintergrund, liest neue Schriften ein und öffnet `http://127.0.0.1:8737` im Browser. Ist der Dienst schon aktiv, öffnet ein weiterer Klick nur das Fenster. Ein Terminal ist dafür nicht nötig.

Beim allerersten Start richtet die App eine eigene Python-Umgebung ein (etwa eine Minute, eine Mitteilung erscheint). Sie braucht `python3`, das über Homebrew oder pyenv vorhanden ist.

Beenden: links unten in der Seitenleiste auf „Beenden“. Wer es vergisst: Nach acht Stunden ohne Benutzung beendet sich der Dienst selbst.

Die App neu bauen (nach Änderungen am Code): `./macos/build_app.sh`, danach `dist/Schriftkasten.app` nach `~/Applications` kopieren.

**Aus dem Terminal** (für Entwicklung):

```
./schriftkasten          # geänderte Dateien einlesen, Oberfläche öffnen
./schriftkasten full     # alles neu einlesen
./schriftkasten scan     # nur einlesen
```

Das Einlesen von rund 1.300 Dateien dauert unter zehn Sekunden. Danach werden nur neue oder geänderte Dateien gelesen.

## Was eingelesen wird

| Quelle | Ordner | Status |
|---|---|---|
| Meine Schriften | `~/Library/Fonts` | installiert |
| Alle Benutzer | `/Library/Fonts` | installiert |
| Adobe Fonts | `~/Library/Application Support/Adobe/CoreSync/plugins/livetype` | installiert |
| FontBase | `~/FontBase` | nicht aktiv |
| Archiv | `~/Schriften-Archiv` | aussortiert |

**Adobe Fonts:** Creative Cloud legt aktivierte Schriften in einem versteckten Ordner ab, mit Nummern statt Namen. Der Schriftkasten liest sie dort aus und holt sich Familie und Adobe-Link aus der `entitlements.xml` daneben. Wer in Creative Cloud oder auf fonts.adobe.com etwas aktiviert oder deaktiviert, klickt danach auf „Neu einlesen“. Favoriten und Web-Projekte liegen nur online bei Adobe und lassen sich von hier nicht abrufen.

**Weitere Ordner** (externe Platte, Projektordner): `config.example.json` als `config.json` nach `~/Library/Application Support/Schriftkasten/` kopieren und unter `extraSources` eintragen. Dort lässt sich auch der Archiv-Ordner ändern und mit `"includeSystem": true` die macOS-Systemschriften dazunehmen.

## Was die Oberfläche kann

- **Suchen** nach Name, Gestalter, Foundry, Tag, Notiz oder Sammlung. Taste `/` springt ins Suchfeld.
- **Vorschautext** frei eingeben oder Vorlagen wählen: Name, Satz mit Umlauten, Titel, Untertitel, Alphabet, Ziffern.
- **Schnitt** für alle Zeilen gleichzeitig umschalten (Light, Regular, Bold, Kursiv). Bei variablen Schriften wird die Achse direkt gesetzt.
- **Hell/Dunkel**: die dunkle Fläche zeigt, wie eine Schrift als heller Titel auf Bild wirkt.
- **Liste, Raster, Absatz** als Ansichten.
- **Filter**: nur mit vollständigen Umlauten, mit Kursive, ab vier Stärken, variabel, ohne Trial/Demo, nur installiert.
- **Detailansicht** (Klick auf den Namen, `←` `→` blättern, `1` bis `3` bewerten, `c` zum Vergleich):
  alle Schnitte, Wasserfall von 12 bis 96 px, Zeichen-Check (ä ö ü ß ẞ, deutsche Anführungen, Euro, Osteuropa, Kyrillisch, Griechisch), OpenType-Funktionen zum Durchschalten (Mediävalziffern, Kapitälchen, Stylistic Sets …), Regler für variable Achsen, Titel mit Absatz, Lizenz und Dateipfade, „Im Finder zeigen“, Links zu Google Fonts bzw. Adobe Fonts.
- **Vergleich**: bis zu acht Familien mit ⊕ markieren, dann nebeneinander als Zeilen oder als Titel mit Absatz. Der Text ist dort direkt editierbar.
- **Sammlungen**: über ◇ an jeder Zeile, per Drag & Drop auf eine Sammlung links, oder in der Detailansicht. Sammlungen haben eine Beschreibung und lassen sich als Namensliste kopieren.
- **Installieren**: Schriften aus FontBase oder dem Archiv mit einem Klick nach `~/Library/Fonts` kopieren.

## Finden: Suchprofile, Ähnliche, Paarungen

- **Ich suche …** (Seitenleiste): kuratierte Listen für typische Fälle, etwa „Grotesk mit dezentem Charakter“, „Serif für Logo & Wortmarke“ oder „Serif für Fließtext“. Sortiert nach Name zeigt sich die empfohlene Reihenfolge. Mit „Als Sammlung übernehmen“ wird daraus eine eigene, veränderbare Sammlung.
- **Ähnlich in deinem Bestand** (Detailansicht): sechs Familien mit ähnlicher Form. Grundlage ist eine Messung der Buchstaben: x-Höhe, Strichstärke, Kontrast, Breite, Rundung, Serifen.
- **Passt dazu** (Detailansicht): Paarungen von Serif und Grotesk mit passender x-Höhe, als kleine Probe aus Titel und Absatz. Handverlesene Paarungen sind mit „kuratiert“ markiert.

## Herkunft & Lizenz

Jede Familie bekommt eine Herkunft, sichtbar als Kennzeichen in der Zeile und als Gruppe in der Seitenleiste:

| Herkunft | Bedeutung |
|---|---|
| Google Fonts | freie Lizenz, uneingeschränkt nutzbar |
| Open Source | freie Lizenz (OFL, GPL, GUST u. a.) |
| Adobe Fonts | über das Adobe-Abo lizenziert |
| macOS | kommt mit macOS; Nutzung ok, Weitergabe nicht |
| Microsoft | kommt mit Office/Windows |
| Kommerziell | Kauf- oder Foundry-Schrift, Lizenzumfang prüfen |
| Aus dem Netz | Herkunft unklar, meist Free-Font-Seiten |
| Trial / Demo | nicht für Kundenarbeit |

Die Zuordnung stützt sich auf die Google-Fonts-Daten, die Liste der macOS-Systemschriften und die Lizenzfelder in den Dateien. Bei „Kommerziell“ und „Aus dem Netz“ ist das eine Einschätzung, keine Rechtsauskunft.

## An die Schriftsammlung übergeben

In jeder Sammlung, jedem Suchprofil und jeder Herkunftsgruppe gibt es „An Schriftsammlung“. Damit legt der Schriftkasten die Liste in der Mac-Schriftsammlung (Font Book) an, mit dem Präfix „SK · “. Ein erneuter Klick ersetzt die Sammlung, statt sie zu verdoppeln. Eigene Sammlungen in Font Book bleiben unberührt. Die Sammlungen erscheinen auch in der Schriftauswahl von Pages, Keynote und TextEdit. Adobe-Programme und DaVinci nutzen sie nicht.

## Einstufung

Jede Familie bekommt automatisch eine Stufe. Die Punkte (0 bis 100) ergeben sich aus der Zahl der Stärken, Kursiven, vollständigen Umlauten, Abdeckung für osteuropäische Sprachen, OpenType-Funktionen und bekannter Herkunft (Google, Adobe, OFL).

| Stufe | Bedeutung |
|---|---|
| Solide Basis | vollständige Familie, sicher für Fließtext, Untertitel, Web |
| Brauchbar | ordentlich, aber mit Lücken |
| Mit Charakter | Display und Schreibschrift, für Titel und Akzente |
| Einzelschnitte | meist ein Schnitt, unbekannte Herkunft |
| Eingeschränkt | Trial/Demo, nur privat, oder ä ö ü ß fehlen |

Die Art (Grotesk, Serif, Slab, Display, Schreibschrift, Mono) kommt bei Google-Schriften aus den offiziellen Google-Fonts-Daten, sonst aus den Angaben in der Datei und dem Namen. Wo das nicht reicht, steht „Ohne Zuordnung“; in der Detailansicht unter „Meine Notizen“ lässt sich die Art von Hand setzen.

## Aufräumen

Unter **Werkstatt → Aufräumen**:

- **Doppelt installiert**: derselbe Schnitt in mehreren Dateien, meist OTF und TTF nebeneinander, oft in unterschiedlichen Versionen. Programme greifen dann zufällig auf eine davon zu. Vorgeschlagen wird, jeweils die neueste Version zu behalten.
- **Trial, Demo, nur privat**: für Kundenarbeit meist nicht freigegeben.
- **Ohne vollständige Umlaute**
- **Nicht lesbar oder veraltet** (EOT, Type 1, kaputte Dateien)

„Aussortieren“ verschiebt Dateien aus `~/Library/Fonts` nach `~/Schriften-Archiv`. Gelöscht wird nichts. Aus dem Archiv holt „Installieren“ eine Schrift zurück. Programme wie Premiere, DaVinci oder InDesign bemerken das nach einem Neustart.

## Deine Daten

Die App speichert alles in `~/Library/Application Support/Schriftkasten/`, der Terminal-Start im Ordner `data/` des Repos. Dort liegt auch `server.log`, falls etwas nicht startet, und optional `config.json`.

| Datei | Inhalt |
|---|---|
| `data/userdata.json` | Sammlungen, Bewertungen, Tags, Notizen, eigene Zuordnungen |
| `data/userdata.bak.json` | Stand vor der letzten Änderung |
| `data/catalog.json` | der eingelesene Bestand (wird bei jedem Einlesen neu geschrieben) |
| `curated.json` | erste Kuratierung: Startsammlungen, Kurznotizen, Zuordnungen |
| `data/google-fonts-meta.json` | Kategorien aller Google-Fonts-Familien |

`userdata.json` ist die einzige Datei, die man sichern muss. Wer den Ordner als Git-Repo führt, kann sie mit einchecken; Katalog und Zwischenspeicher sind in `.gitignore` ausgenommen.

## Technik

- `scan.py` liest Schriftdateien mit [fontTools](https://github.com/fonttools/fonttools): Namen, Stärken, Breiten, Achsen, OpenType-Funktionen, Zeichenabdeckung, Lizenzfelder.
- `serve.py` ist ein kleiner Server ohne weitere Abhängigkeiten. Er läuft nur auf `127.0.0.1`, liefert die Schriftdateien für die Vorschau (Schriften aus `.ttc`-Sammlungen werden dafür einzeln herausgelöst) und speichert die Nutzerdaten. Schreibende Anfragen von fremden Webseiten werden abgewiesen.
- `web/` ist die Oberfläche: eine HTML-Seite, ein Stylesheet, ein Skript. Kein Build-Schritt.

Schriften werden erst geladen, wenn sie ins Bild scrollen. Auch bei mehreren tausend Familien bleibt die Seite flüssig.
