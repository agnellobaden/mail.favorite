# E-Mail Import System für Eisfavorite Buchungen

## Übersicht

Dieses System ermöglicht es, E-Mail-Anfragen von **eisfavorit@gmail.com** automatisch zu importieren und in die Buchungsübersicht zu übernehmen.

---

## 📋 Schritt-für-Schritt Anleitung

### 1️⃣ Gmail App-Passwort erstellen

Da Gmail 2-Faktor-Authentifizierung erfordert, musst du ein **App-Passwort** erstellen:

1. Gehe zu: **https://myaccount.google.com/security**
2. Stelle sicher, dass **2-Faktor-Authentifizierung** aktiviert ist
3. Scrolle zu **"App-Passwörter"** und klicke darauf
4. Wähle **"Mail"** und **"Windows-Computer"**
5. Google generiert ein 16-stelliges Passwort (z.B. `abcd efgh ijkl mnop`)
6. **Kopiere dieses Passwort** (ohne Leerzeichen)

### 2️⃣ App-Passwort eintragen

1. Öffne die Datei **`email_importer.py`** mit einem Texteditor
2. Finde Zeile 17: `PASSWORD = ""`
3. Trage dein App-Passwort ein:
   ```python
   PASSWORD = "abcdefghijklmnop"  # Ohne Leerzeichen!
   ```
4. **Speichern** nicht vergessen!

### 3️⃣ Python installieren (falls nicht vorhanden)

Das Skript benötigt Python 3.6 oder höher.

**Download:** https://www.python.org/downloads/

Bei der Installation: **"Add Python to PATH"** aktivieren!

### 4️⃣ E-Mails importieren

1. **Öffne die Kommandozeile** (CMD oder PowerShell)
2. Navigiere zum Ordner:
   ```bash
   cd "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite"
   ```
3. Führe das Skript aus:
   ```bash
   python email_importer.py
   ```

**Was passiert:**
- Das Skript verbindet sich mit Gmail
- Ruft alle **ungelesenen** E-Mails ab
- Extrahiert automatisch:
  - Name
  - E-Mail-Adresse
  - Telefonnummer
  - Datum & Uhrzeit
  - Adresse (Straße, PLZ, Stadt)
  - Anzahl Gäste
  - Wunschsorten
  - Notizen (E-Mail-Text)
- Speichert die Daten in `neue-anfragen.json`

### 5️⃣ Daten in Buchungsübersicht laden

1. Öffne **`buchungen-uebersicht.html`** im Browser
2. Klicke auf **"📧 E-Mail Import (JSON)"**
3. Wähle die Datei **`neue-anfragen.json`**
4. Die neuen Anfragen werden automatisch hinzugefügt!

---

## 🔄 Automatisierung (Optional)

Du kannst das Skript automatisch ausführen lassen:

### Windows Task Scheduler

1. Öffne **Aufgabenplanung** (Task Scheduler)
2. Erstelle neue Aufgabe
3. Trigger: z.B. täglich um 9:00 Uhr
4. Aktion: `python "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\email_importer.py"`

So werden E-Mails automatisch jeden Morgen importiert!

---

## 🎯 Wie werden Daten erkannt?

Das Skript sucht in E-Mails nach folgenden Mustern:

| Information | Beispiele |
|-------------|-----------|
| **Name** | "Name: Max Mustermann", "Von: Max Mustermann" |
| **E-Mail** | "Email: max@example.com", oder jede E-Mail-Adresse im Text |
| **Telefon** | "Tel: 0123 456789", "Mobil: +49 170 1234567" |
| **Datum** | "Datum: 15.07.2026", "am 15.07.2026" |
| **Uhrzeit** | "Uhrzeit: 14:00", "um 14:00 Uhr" |
| **Gäste** | "Gäste: 50", "50 Personen" |
| **Adresse** | "Straße: Hauptstraße 10", "Adresse: ..." |
| **PLZ** | "PLZ: 12345", oder 5-stellige Zahl vor Stadtname |
| **Stadt** | "Stadt: München", "12345 München" |
| **Firma** | "Firma: ABC GmbH" |
| **Sorten** | "Sorten: Vanille, Schokolade", "Wunsch: Erdbeere" |

**Tipp:** Je strukturierter die E-Mails sind, desto besser funktioniert der Import!

---

## 📝 Empfehlung für Kunden

Schicke deinen Kunden eine E-Mail-Vorlage, damit die Anfragen einheitlich sind:

```
Betreff: Buchungsanfrage Eiscatering

Name: [Vorname Nachname]
Firma: [Optional]
E-Mail: [E-Mail-Adresse]
Telefon: [Telefonnummer]

Veranstaltungsdatum: [TT.MM.JJJJ]
Uhrzeit: [HH:MM]
Anzahl Gäste: [Anzahl]

Adresse:
Straße: [Straße Hausnummer]
PLZ: [PLZ]
Stadt: [Stadt]

Wunschsorten: [z.B. Vanille, Schokolade, Erdbeere]

Weitere Anmerkungen:
[...]
```

---

## ⚠️ Wichtige Hinweise

### Sicherheit
- **App-Passwort NIEMALS öffentlich teilen!**
- Die Datei `email_importer.py` mit Passwort nicht hochladen (GitHub, etc.)
- Regelmäßig Backups erstellen

### E-Mails werden als gelesen markiert
- Nach dem Import sind die E-Mails nicht mehr "ungelesen"
- Beim nächsten Durchlauf werden nur neue E-Mails importiert
- Falls du eine E-Mail erneut importieren möchtest, markiere sie in Gmail als "ungelesen"

### Qualität der Extraktion
- Das Skript kann nur Informationen extrahieren, die in der E-Mail stehen
- Bei unstrukturierten E-Mails können Daten fehlen
- Prüfe die importierten Daten in der Buchungsübersicht
- Ergänze fehlende Informationen manuell

---

## 🛠️ Fehlerbehebung

### "Fehler beim Login"
- Prüfe, ob das App-Passwort korrekt eingetragen ist
- Stelle sicher, dass 2-Faktor-Authentifizierung aktiv ist
- Versuche ein neues App-Passwort zu erstellen

### "Keine neuen E-Mails gefunden"
- Das Skript importiert nur **ungelesene** E-Mails
- Markiere E-Mails in Gmail als ungelesen, um sie zu importieren
- Prüfe, ob du mit dem richtigen Gmail-Konto verbunden bist

### "Python wird nicht erkannt"
- Stelle sicher, dass Python installiert ist
- Prüfe ob Python im PATH ist: `python --version`
- Installiere Python neu mit "Add to PATH" Option

### Daten fehlen nach Import
- Öffne `neue-anfragen.json` und prüfe, welche Daten extrahiert wurden
- Passe das E-Mail-Format an, damit mehr Informationen erkannt werden
- Ergänze fehlende Daten manuell in der Buchungsübersicht

---

## 📊 Workflow-Übersicht

```
1. Kunde sendet E-Mail an eisfavorit@gmail.com
           ↓
2. Führe email_importer.py aus
           ↓
3. Skript erstellt neue-anfragen.json
           ↓
4. Importiere JSON in buchungen-uebersicht.html
           ↓
5. Prüfe und ergänze Daten bei Bedarf
           ↓
6. Kunde kontaktieren & Buchung bestätigen
```

---

## 💡 Tipps

- Führe den Import **täglich** aus, um keine Anfragen zu verpassen
- Erstelle regelmäßig **Backups** (Button "📥 CSV exportieren")
- Nutze die **Filter-Funktion** um neue Anfragen zu finden (Status: Neu)
- Markiere bearbeitete Anfragen als "Gebucht" oder "Archiviert"

---

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe diese Anleitung nochmal
2. Schaue in die Fehlermeldung des Skripts
3. Prüfe die generierte `neue-anfragen.json` Datei

---

**Viel Erfolg mit dem automatischen E-Mail-Import! 🍦**
