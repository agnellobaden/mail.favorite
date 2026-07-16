# 📧 Gmail Export Tool - Installations-Anleitung

## Schritt 1: Python installieren

Falls noch nicht installiert:
1. Download: https://www.python.org/downloads/
2. Bei Installation **"Add Python to PATH"** anhaken!

## Schritt 2: Abhängigkeiten installieren

Öffne die Eingabeaufforderung (CMD) im Projektordner und führe aus:

```bash
pip install -r requirements.txt
```

## Schritt 3: Gmail API aktivieren

### 3.1 Google Cloud Console öffnen
1. Gehe zu: https://console.cloud.google.com/
2. Melde dich mit deinem Google-Konto an (`eisfavorit@gmail.com`)

### 3.2 Neues Projekt erstellen
1. Klicke oben links auf **"Projekt auswählen"**
2. Klicke auf **"NEUES PROJEKT"**
3. Name: `EisFavorite Mail Export`
4. Klicke auf **"ERSTELLEN"**

### 3.3 Gmail API aktivieren
1. Im neuen Projekt, gehe zu **"APIs & Dienste" > "Bibliothek"**
2. Suche nach **"Gmail API"**
3. Klicke darauf und dann auf **"AKTIVIEREN"**

### 3.4 OAuth-Zustimmungsbildschirm konfigurieren
1. Gehe zu **"APIs & Dienste" > "OAuth-Zustimmungsbildschirm"**
2. Wähle **"Extern"** und klicke auf **"ERSTELLEN"**
3. Fülle das Formular aus:
   - App-Name: `EisFavorite Mail Export`
   - Nutzer-Support-E-Mail: `eisfavorit@gmail.com`
   - Entwickler-Kontaktinformationen: `eisfavorit@gmail.com`
4. Klicke auf **"SPEICHERN UND FORTFAHREN"**
5. Bei "Bereiche" klicke auf **"BEREICHE HINZUFÜGEN ODER ENTFERNEN"**
6. Suche nach **"Gmail API"** und wähle:
   - `.../auth/gmail.readonly` (E-Mails lesen)
7. Klicke auf **"SPEICHERN UND FORTFAHREN"**
8. Bei "Testnutzer" klicke auf **"NUTZER HINZUFÜGEN"**
9. Füge hinzu: `eisfavorit@gmail.com`
10. Klicke auf **"SPEICHERN UND FORTFAHREN"**

### 3.5 OAuth-Client-ID erstellen
1. Gehe zu **"APIs & Dienste" > "Anmeldedaten"**
2. Klicke auf **"+ ANMELDEDATEN ERSTELLEN"**
3. Wähle **"OAuth-Client-ID"**
4. Anwendungstyp: **"Desktopanwendung"**
5. Name: `EisFavorite Desktop Client`
6. Klicke auf **"ERSTELLEN"**

### 3.6 Credentials herunterladen
1. Klicke auf das Download-Symbol (↓) neben der erstellten Client-ID
2. Speichere die Datei als **`credentials.json`** im Projektordner:
   ```
   c:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\credentials.json
   ```

## Schritt 4: Tool ausführen

Öffne die Eingabeaufforderung (CMD) im Projektordner und führe aus:

```bash
python gmail-export-tool.py
```

### Beim ersten Start:
1. Ein Browser-Fenster öffnet sich
2. Melde dich mit `eisfavorit@gmail.com` an
3. Klicke auf **"Zulassen"**
4. Das Tool ist jetzt verbunden!

## Schritt 5: E-Mails exportieren

Das Tool fragt dich:
1. **Suchoptionen wählen:**
   - `1` = Alle E-Mails der letzten 30 Tage
   - `2` = Nur ungelesene E-Mails
   - `3` = E-Mails mit Stichwort (z.B. "Buchung", "Anfrage")
   - `4` = Benutzerdefinierte Suche

2. **Maximale Anzahl** (z.B. 50)

3. Das Tool exportiert die E-Mails als JSON-Datei:
   ```
   buchungen-export-2026-07-15-143022.json
   ```

## Schritt 6: JSON in Buchungsverwaltung importieren

1. Öffne: https://maileisfavorite.vercel.app
2. Klicke auf **"📧 E-Mails prüfen"** (oder die orange Statistik-Karte)
3. Wähle die exportierte JSON-Datei aus
4. **Fertig!** Die Buchungen werden mit **"📧 Neu eingetroffen!"** Badge angezeigt

---

## 🔧 Tipps & Troubleshooting

### Fehler: "credentials.json nicht gefunden"
→ Stelle sicher, dass die Datei im richtigen Ordner liegt

### Fehler: "Access denied"
→ Überprüfe, dass `eisfavorit@gmail.com` als Testnutzer hinzugefügt ist

### Keine E-Mails gefunden
→ Versuche eine andere Suchoption oder erweitere den Zeitraum

### Token abgelaufen
→ Lösche `token.json` und führe das Tool erneut aus

---

## 📚 Erweiterte Gmail-Suche

Du kannst auch spezifische Suchqueries verwenden (Option 4):

- `from:kunde@beispiel.de` - E-Mails von bestimmtem Absender
- `subject:Buchung` - E-Mails mit "Buchung" im Betreff
- `after:2026/07/01` - E-Mails nach bestimmtem Datum
- `is:unread subject:Anfrage` - Ungelesene Anfragen

Mehr Infos: https://support.google.com/mail/answer/7190

---

## 🆘 Hilfe

Bei Fragen oder Problemen:
1. Überprüfe alle Schritte in dieser Anleitung
2. Stelle sicher, dass Python korrekt installiert ist
3. Überprüfe, dass die Gmail API aktiviert ist

**Viel Erfolg!** 🍦
