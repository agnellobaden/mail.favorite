# 📥 n8n Workflows importieren - Schnellstart

## 🚀 Vorbereitete Workflows

In diesem Ordner findest du **fertige n8n-Workflows**, die du direkt importieren kannst:

1. **`n8n-workflow-email-import.json`**
   - Automatischer Gmail → Firebase Import
   - Läuft jede Minute
   - Extrahiert alle Buchungsdaten aus E-Mails

2. **`n8n-workflow-24h-reminder.json`**
   - Sendet automatisch Erinnerungs-E-Mails
   - Läuft täglich um 9:00 Uhr
   - Benachrichtigt Kunden 24h vor Event

---

## 📋 Schritt-für-Schritt: Workflows importieren

### Schritt 1: n8n öffnen

1. Gehe zu: **https://app.n8n.cloud/** (oder deine selbst-gehostete n8n-Instanz)
2. Logge dich ein

### Schritt 2: Workflow importieren

1. Klicke oben rechts auf **"+"** (Neuer Workflow)
2. Klicke auf das **"⋮" Menü** (3 Punkte) oben rechts
3. Wähle **"Import from File..."**
4. Wähle die Datei: `n8n-workflow-email-import.json`
5. ✅ Workflow wird geladen!

### Schritt 3: Credentials einrichten

Der Workflow braucht 2 Credentials:

#### A) Gmail Credentials

1. Klicke auf den **"Gmail Trigger"** Node
2. Klicke auf **"Create new credential"**
3. Wähle **"OAuth2"**
4. Folge den Anweisungen:
   - Google Account verbinden
   - E-Mail: `eisfavorit@gmail.com`
   - Berechtigungen erlauben
5. ✅ Gmail verbunden!

#### B) Firebase Credentials

1. Gehe zu: **https://console.firebase.google.com/**
2. Wähle Projekt: **mailfavorite-e8f49**
3. Gehe zu **Project Settings** ⚙️ → **Service Accounts**
4. Klicke **"Generate new private key"**
5. Lade die **JSON-Datei** herunter

Zurück in n8n:

6. Klicke auf den **"Firebase speichern"** Node
7. Klicke auf **"Create new credential"**
8. Credential Type: **"Service Account"**
9. Öffne die heruntergeladene JSON-Datei
10. Kopiere den **gesamten Inhalt**
11. Füge ihn in n8n ein
12. ✅ Firebase verbunden!

### Schritt 4: Workflow aktivieren

1. Klicke oben rechts auf den **Toggle-Switch** "Inactive"
2. Schalte auf **"Active"** ✅
3. **Fertig!** Der Workflow läuft jetzt automatisch!

### Schritt 5: Workflow testen

#### Test für E-Mail-Import:

1. Sende eine Test-E-Mail an `eisfavorit@gmail.com`:

```
Betreff: Buchungsanfrage

Name: Max Mustermann
E-Mail: max@example.com
Telefon: 0123 456789
Datum: 25.07.2026
Uhrzeit: 14:00
Gäste: 50
Straße: Hauptstraße 10
PLZ: 12345
Stadt: München
Firma: TestFirma GmbH
Wunschsorten: Vanille, Schokolade
```

2. Warte **1 Minute** (Workflow läuft jede Minute)
3. Öffne **buchungen-uebersicht.html**
4. ✅ Die neue Buchung sollte erscheinen!

#### Test für 24h-Erinnerung:

1. Erstelle eine Test-Buchung mit:
   - Status: **Gebucht**
   - Datum: **Morgen**
   - Uhrzeit: **14:00**
   - E-Mail: **Deine Test-E-Mail**
2. Klicke in n8n auf den Workflow
3. Klicke **"Execute Workflow"** (manuell testen)
4. ✅ Du solltest eine Erinnerungs-E-Mail erhalten!

---

## 🔄 Workflow 2 importieren (24h-Erinnerung)

Wiederhole die obigen Schritte für:

- Datei: **`n8n-workflow-24h-reminder.json`**
- Verwende die **gleichen Credentials** (Gmail & Firebase)
- Aktivieren ✅

---

## ⚙️ Workflows anpassen

### Zeitplan ändern (Cron):

1. Klicke auf den **"Schedule Trigger"** Node
2. Wähle:
   - **Interval**: Alle X Minuten/Stunden
   - **Cron Expression**: Für genaue Zeiten
     - `0 9 * * *` = Täglich 9:00 Uhr
     - `0 */2 * * *` = Alle 2 Stunden
     - `*/5 * * * *` = Alle 5 Minuten

### E-Mail-Text ändern:

1. Klicke auf den **"E-Mail senden"** Node
2. Bearbeite das **"Message"** Feld
3. Verwende Variablen: `{{ $json.name }}`, `{{ $json.date }}`, etc.

### BCC ändern:

1. Klicke auf **"E-Mail senden"** Node
2. Unter **"Options"** → **"BCC"**
3. Ändere `eisfavorit@gmail.com` zu deiner E-Mail

---

## 📊 Workflow-Ausführungen überwachen

1. Gehe zu **"Executions"** (linke Sidebar in n8n)
2. Sieh alle bisherigen Ausführungen
3. Klicke auf eine Ausführung um Details zu sehen:
   - ✅ **Success**: Alles ok
   - ❌ **Error**: Fehler aufgetreten (klicke für Details)

---

## 🐛 Fehlerbehebung

### "No items found to process"

➡️ **Lösung**: Keine E-Mails im UNREAD-Label. Sende eine Test-E-Mail.

### "Invalid credentials"

➡️ **Lösung**:
- Prüfe Gmail: App-Passwort korrekt?
- Prüfe Firebase: Service Account JSON korrekt eingefügt?

### "Firebase: Permission denied"

➡️ **Lösung**:
- Gehe zu Firebase Console
- **Firestore Rules** prüfen
- Stelle sicher, dass Service Account Schreibrechte hat

### "Email not sent"

➡️ **Lösung**:
- Prüfe Gmail-Limits (max. 500 E-Mails/Tag)
- Prüfe E-Mail-Adresse im Booking

---

## 💡 Tipps & Tricks

### Debug-Modus:

1. Klicke auf **"Execute Workflow"** (manuell starten)
2. Klicke auf jeden Node um Output zu sehen
3. Finde Fehler schnell!

### Workflow duplizieren:

1. **"⋮" Menü** → **"Duplicate"**
2. Teste Änderungen erst in der Kopie
3. Aktiviere erst wenn alles funktioniert

### Benachrichtigungen bei Fehlern:

1. Füge **"Error Trigger"** Node hinzu
2. Verbinde mit **"Gmail"** oder **"Telegram"**
3. Erhalte Benachrichtigung bei Workflow-Fehlern!

---

## 📚 Weitere Workflows erstellen

### Ideen für weitere Automatisierungen:

1. **Überfällige Rechnungen**:
   - Firebase → Filter (invoiceSent=true, invoicePaid=false)
   - → Gmail (Zahlungserinnerung)

2. **CSV-Backup**:
   - Schedule (täglich 23:00)
   - → Firebase (alle Buchungen)
   - → Function (konvertiere zu CSV)
   - → Google Drive (speichern)

3. **WhatsApp-Benachrichtigungen**:
   - Firebase Trigger (neue Buchung)
   - → Twilio WhatsApp (Benachrichtigung aufs Handy)

4. **Telegram-Bot**:
   - Telegram Trigger
   - → Kommandos: `/heute`, `/woche`, `/statistik`
   - → Firebase (Daten abrufen)
   - → Telegram (Antwort senden)

---

## 🎓 Weiterführende Ressourcen

- **n8n Docs**: https://docs.n8n.io/
- **n8n Community**: https://community.n8n.io/
- **Workflow Templates**: https://n8n.io/workflows/
- **YouTube Tutorials**: "n8n Tutorial deutsch"

---

## ✅ Checkliste: Setup komplett

- [ ] n8n Account erstellt
- [ ] Gmail Credentials eingerichtet
- [ ] Firebase Service Account erstellt
- [ ] Workflow 1 importiert (E-Mail-Import)
- [ ] Workflow 1 getestet ✅
- [ ] Workflow 1 aktiviert ✅
- [ ] Workflow 2 importiert (24h-Erinnerung)
- [ ] Workflow 2 getestet ✅
- [ ] Workflow 2 aktiviert ✅

**🎉 Herzlichen Glückwunsch! Dein EisFavorite-System läuft jetzt vollautomatisch!**

---

## 📞 Support

Bei Problemen:

1. Prüfe **n8n Executions** für Fehlerdetails
2. Schaue in die **N8N-INTEGRATION.md** für Details
3. Frage in der **n8n Community**: https://community.n8n.io/

---

**Viel Erfolg mit der Automatisierung! 🍦🚀**
