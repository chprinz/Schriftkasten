# Schriftkasten

Ein kleines Werkzeug für den Mac, um die eigenen Schriften wiederzufinden, nebeneinanderzulegen und aufzuräumen. Es läuft lokal, ohne Konto und ohne Cloud.

## Warum es das gibt

Schriften landen mit der Zeit überall: im Benutzerordner, im Systemordner, in FontBase, in einem Archiv. Bei Adobe Fonts liegen sie in einem versteckten Ordner, und die Dateien heißen dort nur Nummern. Font Book zeigt davon einen Teil, aber vergleichen, bewerten oder sortieren lässt sich kaum etwas.

Wer für Kunden arbeitet, will vor dem Einsatz wissen, ob eine Schrift überhaupt freigegeben ist und ob ä, ö, ü und ß vorhanden sind. Genau das beantwortet der Schriftkasten.

## Was er macht

Er liest alle Schriftordner ein und zeigt jede Familie mit echter Vorschau im Browser. Du kannst

- nach Name, Foundry, Tag oder Notiz suchen und mit eigenem Text probesetzen,
- Schriften in Sammlungen ordnen, bewerten und nebeneinander vergleichen,
- die Herkunft sehen (Google Fonts, Adobe, macOS, kommerziell, Trial) und Hinweise zur Lizenz,
- ähnliche Schriften und passende Paarungen aus dem eigenen Bestand finden,
- doppelt installierte, unvollständige oder kaputte Schriften aufspüren und ins Archiv verschieben,
- Sammlungen an Font Book übergeben, damit sie in Pages, Keynote und TextEdit auftauchen.

Gelöscht wird nichts. Aussortierte Schriften landen in `~/Schriften-Archiv` und lassen sich zurückholen.

## Installieren

1. Unter [Releases](../../releases/latest) die ZIP-Datei laden und entpacken.
2. `Schriftkasten.app` in den Ordner `Programme` (oder `~/Applications`) ziehen.
3. Beim ersten Öffnen blockt macOS die App, weil sie nicht notarisiert ist. In den Systemeinstellungen unter Datenschutz & Sicherheit auf „Trotzdem öffnen“ klicken.

Beim ersten Start richtet die App eine eigene Python-Umgebung ein. Das dauert etwa eine Minute. Dafür muss `python3` installiert sein, zum Beispiel über Homebrew (`brew install python`). Danach öffnet sich die Oberfläche im Browser. Beenden kannst du links unten mit „Beenden“.

Aus dem Quellcode: `./macos/build_app.sh` baut die App nach `dist/`.

## Datenschutz

Der Dienst hört nur auf `127.0.0.1`. Deine Sammlungen, Bewertungen und Notizen liegen in `~/Library/Application Support/Schriftkasten/`. Nichts wird hochgeladen.

## Mehr

Alle Funktionen, Tastenkürzel und die Technik dahinter stehen im [Handbuch](docs/HANDBUCH.md).
