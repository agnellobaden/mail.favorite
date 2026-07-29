# 📦 Automatisches wöchentliches Backup – Setup

Workflow-Datei: `n8n-workflow-backup-woechentlich.json`

## Was er macht

Jeden **Montag um 6:00 Uhr**:
1. Lädt alle Buchungen aus Firebase (Collection `buchungen`)
2. Baut daraus eine CSV-Datei (gleiche Spalten wie der manuelle CSV-Export
   in der Buchungsübersicht: Name, E-Mail, Datum, Status, Preise, Adresse, …)
3. Verschickt die CSV-Datei als Anhang per E-Mail an **eisfavorit@gmail.com**

So hast du automatisch jede Woche eine aktuelle Sicherung, ohne selbst
daran denken zu müssen – landet einfach im Postfach, kann dort archiviert
oder z.B. automatisch in einen "Backups"-Ordner einsortiert werden.

## Einrichtung

1. In n8n: **Workflows → Import from File** → `n8n-workflow-backup-woechentlich.json`
2. Bei den beiden Nodes ("Alle Buchungen laden" und "Backup per E-Mail senden")
   die bereits vorhandenen Credentials auswählen (dieselben wie beim
   24h-Erinnerungs-Workflow – Firebase Service Account bzw. Gmail-Konto)
3. Beim Node "Backup per E-Mail senden" prüfen, ob der Anhang korrekt auf
   die Binärdaten aus dem vorherigen Node zeigt (Feld "data") – je nach
   n8n-Version kann die Anhang-Option beim Import leicht anders benannt
   sein, dann im Editor einmal neu auswählen
4. Workflow **aktivieren**

## Anpassen

- Anderer Wochentag/Uhrzeit: Node "Jeden Montag, 6:00 Uhr" bearbeiten
- Andere Empfänger-Adresse: Node "Backup per E-Mail senden" → Feld "sendTo"
- Zusätzlich in Google Drive ablegen statt/zusätzlich zur E-Mail: nach dem
  Node "CSV erstellen" einen Google-Drive-Node einfügen, der die Binärdaten
  hochlädt
