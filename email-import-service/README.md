# Automatischer E-Mail-Import (eisfavorite.de → Firestore)

Läuft periodisch, holt neue Anfrage-E-Mails (von eisfavorite.de über EmailJS
an `eisfavorit@gmail.com`) per IMAP ab und schreibt sie **direkt** in die
Firestore-Sammlung `buchungen` (status "Neu"). Keine manuelle JSON-Import
mehr nötig - die Anfrage erscheint automatisch als Karte in der
Buchungsübersicht.

Erkennt zusätzlich Antwort-E-Mails von Kunden (kein "Contact Us:"-Betreff):
passt der Absender zum `email`-Feld einer bestehenden Buchung, wird die
Nachricht automatisch als "empfangen" in deren Chat-Verlauf
(`emailHistory`) übernommen - erscheint dann als graue Sprechblase im
Chat-Fenster in `buchungen-uebersicht.html`, ganz ohne manuelles Kopieren.

**Hinweis:** eisfavorite.de schreibt bei den meisten Anfragen inzwischen
bereits selbst direkt in Firestore (zu erkennen an `source: "website"` in
den Buchungsdaten) - dieser Dienst hier ist die Rückfalllösung für
Anfragen, die nur als E-Mail ankommen, ohne diesen direkten Weg.

Da die Firestore-Regeln aktuell offen sind (`allow read, write: if true`),
reicht die öffentliche Web-API - **kein Firebase-Admin-Schlüssel nötig.**
⚠️ Das ist gleichzeitig ein Sicherheitsrisiko für die gesamte App, nicht nur
für diesen Import - siehe `ANLEITUNG-SICHERHEIT.md`.

## Einmalige Einrichtung

### 1. Gmail-App-Passwort erstellen

1. https://myaccount.google.com/security öffnen, mit `eisfavorit@gmail.com` anmelden
2. "Bestätigung in zwei Schritten" aktivieren (falls noch nicht aktiv)
3. Zu "App-Passwörter" gehen → App: "Mail" → Gerät: "Windows-Computer" → Generieren
4. Das 16-stellige Passwort kopieren

### 2. config.json anlegen

`config.example.json` kopieren zu `config.json` und das App-Passwort aus
Schritt 1 eintragen:

```json
{
  "gmailAppPassword": "abcd efgh ijkl mnop"
}
```

Diese Datei ist in `.gitignore` und wird nie committet.

### 3. Abhängigkeiten installieren

```bash
cd email-import-service
npm install
```

### 4. Einmal manuell testen

```bash
node import.js
```

Sollte ausgeben, wie viele ungelesene E-Mails gefunden und importiert wurden.
Danach in der Buchungsübersicht prüfen, ob die Test-Anfrage als neue Karte
mit Status "Neu" erscheint.

## Automatisch alle paar Minuten laufen lassen (Windows)

Über die Aufgabenplanung (`taskschd.msc`):

1. Aufgabe erstellen → Name z.B. "EisFavorite E-Mail-Import"
2. Trigger: Täglich, wiederholen alle 5 Minuten, Dauer: unbegrenzt
3. Aktion: Programm starten
   - Programm: `node`
   - Argumente: `import.js`
   - Starten in: der volle Pfad zu diesem `email-import-service`-Ordner

Alternativ per Kommandozeile einrichten (PowerShell als Administrator):

```powershell
$action = New-ScheduledTaskAction -Execute "node" -Argument "import.js" -WorkingDirectory "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\email-import-service"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName "EisFavorite E-Mail-Import" -Action $action -Trigger $trigger -Description "Importiert neue Anfragen von eisfavorite.de automatisch in Firestore"
```

## Wie die Daten erkannt werden

Das Script sucht per Regex nach Mustern wie `Name:`, `E-Mail:`, `Telefon:`,
`Datum:`, `Gäste:` usw. im E-Mail-Text (Betreff + Nachrichtentext). Wenn das
eisfavorite.de-Formular andere Feldbezeichnungen verwendet, müssen die Muster
in `import.js` (Objekt `PATTERNS`) angepasst werden.

## Fehlerbehebung

- **"Login failed"** → App-Passwort falsch oder 2FA nicht aktiv
- **Keine E-Mails gefunden** → prüfen, ob die Test-Mail wirklich ungelesen im
  Postfach `eisfavorit@gmail.com` liegt (nicht in Spam o.ä.)
- **Firestore-Fehler** → prüfen, ob die Firestore-Regeln (noch) offen sind;
  falls sie inzwischen verschärft wurden, braucht dieser Dienst dann doch
  wieder eine Authentifizierung (z.B. Service-Account)
