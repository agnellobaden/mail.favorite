# Automatischer E-Mail-Import (eisfavorite.de → Firestore)

Läuft periodisch, holt neue Anfrage-E-Mails (von eisfavorite.de über EmailJS
an `eisfavorit@gmail.com`) per IMAP ab und schreibt sie **direkt** als neue
Buchung (Status "Neu") in Firestore. Keine manuelle JSON-Import mehr nötig -
die Anfrage erscheint automatisch als Karte in der Buchungsübersicht.

## Einmalige Einrichtung

### 1. Gmail-App-Passwort erstellen

1. https://myaccount.google.com/security öffnen, mit `eisfavorit@gmail.com` anmelden
2. "Bestätigung in zwei Schritten" aktivieren (falls noch nicht aktiv)
3. Zu "App-Passwörter" gehen → App: "Mail" → Gerät: "Windows-Computer" → Generieren
4. Das 16-stellige Passwort kopieren

### 2. Firebase-Service-Account-Schlüssel erstellen

1. [Firebase Console](https://console.firebase.google.com/) → Projekt `mailfavorite-e8f49`
2. Zahnrad → **Projekteinstellungen** → Tab **Dienstkonten**
3. **Neuen privaten Schlüssel generieren** → JSON-Datei wird heruntergeladen
4. Diese Datei umbenennen zu `firebase-service-account.json` und in diesen Ordner
   (`email-import-service/`) legen

⚠️ **Diese Datei ist ein Admin-Schlüssel mit vollem Zugriff auf die Datenbank
- niemals ins Git-Repo committen!** Sie ist bereits in `.gitignore` eingetragen.

### 3. config.json anlegen

`config.example.json` kopieren zu `config.json` und das App-Passwort aus
Schritt 1 eintragen:

```json
{
  "gmailAppPassword": "abcd efgh ijkl mnop"
}
```

Auch diese Datei ist in `.gitignore` und wird nie committet.

### 4. Abhängigkeiten installieren

```bash
cd email-import-service
npm install
```

### 5. Einmal manuell testen

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
- **Firestore-Fehler** → `firebase-service-account.json` fehlt oder falsches
  Projekt
