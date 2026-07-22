# 🔔 24-Stunden-Erinnerungen - Komplett-Anleitung

## ✅ Was wurde implementiert?

### 1. **Dashboard-Karte** (Lila Karte)
- Zeigt Anzahl der Events, die in 20-32 Stunden stattfinden
- Status muss "Gebucht" sein
- E-Mail ODER Telefon muss vorhanden sein
- Noch keine Erinnerung versendet (weder E-Mail noch SMS)
- **Klickbar**: Leitet zur gefilterten Buchungsübersicht

### 2. **Badge in Buchungskarten**
- Zeigt "📧 ERINNERUNG" wenn E-Mail versendet wurde
- Zeigt "📱 ERINNERUNG" wenn SMS versendet wurde
- Lila Hintergrund mit Gradient
- Sichtbar in Kartenansicht

### 3. **Intelligenter Filter**
- URL: `buchungen-uebersicht.html?filter=reminders`
- Zeigt alle Events mit fälligen Erinnerungen
- Visueller Hinweis im Filter-Header (Gold)

### 4. **n8n-Workflow mit E-Mail & SMS**
- Sendet automatisch E-Mails 24h vor dem Event (wenn E-Mail vorhanden)
- Sendet automatisch SMS 24h vor dem Event (wenn nur Telefon vorhanden)
- Markiert `emailReminderSent: true` oder `smsReminderSent: true` in Firebase
- BCC-Kopie an eisfavorit@gmail.com (bei E-Mails)

---

## 🚀 n8n-Workflow einrichten (Schritt-für-Schritt)

### **Schritt 1: n8n Cloud Account erstellen**

1. Gehe zu: **https://n8n.io/**
2. Klicke auf **"Start for free"**
3. Registriere dich mit deiner E-Mail
4. Bestätige deine E-Mail-Adresse
5. Du bist jetzt in n8n eingeloggt!

**Kostenlos**: 2.500 Workflow-Ausführungen/Monat
(Täglich 1x = 30/Monat → völlig ausreichend!)

---

### **Schritt 2: Firebase Service Account erstellen**

1. Gehe zu: **https://console.firebase.google.com/**
2. Wähle dein Projekt: **`mailfavorite-e8f49`**
3. Klicke auf ⚙️ **Settings** (oben links)
4. Wähle **"Project settings"**
5. Gehe zum Tab **"Service accounts"**
6. Klicke **"Generate new private key"**
7. **WICHTIG**: Speichere die JSON-Datei sicher!

**Die Datei sieht so aus:**
```json
{
  "type": "service_account",
  "project_id": "mailfavorite-e8f49",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xyz@mailfavorite-e8f49.iam.gserviceaccount.com",
  ...
}
```

---

### **Schritt 3: Gmail App-Passwort erstellen**

1. Gehe zu: **https://myaccount.google.com/**
2. Login mit **eisfavorit@gmail.com**
3. Linkes Menü → **"Security"**
4. Scrolle zu **"2-Step Verification"**
   - Falls nicht aktiv: **Aktiviere es jetzt!**
5. Scrolle weiter zu **"App passwords"**
6. Klicke **"App passwords"**
7. Wähle:
   - App: **"Mail"**
   - Device: **"Other (Custom name)"** → "n8n Automation"
8. Klicke **"Generate"**
9. **Kopiere das 16-stellige Passwort!**
   (Format: `xxxx xxxx xxxx xxxx`)

**WICHTIG**: Dieses Passwort wird nur einmal angezeigt!

---

### **Schritt 4: Workflow in n8n importieren**

1. Öffne n8n Dashboard
2. Klicke **"+ New Workflow"** (oben rechts)
3. Klicke **Menü (⋮)** → **"Import from File..."**
4. Wähle die Datei: **`n8n-workflow-24h-reminder.json`**
5. Der Workflow wird geladen!

**Du siehst jetzt 5 Nodes:**
- ⏰ Täglich um 9:00 Uhr (Schedule)
- 📥 Alle Buchungen laden (Firebase)
- 🔍 Filtere: 24h vor Event (Function)
- 📧 E-Mail senden (Gmail)
- ✅ Status aktualisieren (Firebase)

---

### **Schritt 5: Firebase-Credentials in n8n einrichten**

1. Klicke auf Node **"Alle Buchungen laden"**
2. Bei **"Credential to connect with"** → Klicke **"Create New"**
3. Es öffnet sich ein Credentials-Fenster
4. Name: **"Firebase EisFavorite"**
5. **Service Account Email**:
   Kopiere aus der JSON-Datei: `client_email`
   Beispiel: `firebase-adminsdk-xyz@mailfavorite-e8f49.iam.gserviceaccount.com`

6. **Private Key**:
   Kopiere aus der JSON-Datei: `private_key`
   **WICHTIG**: Kopiere den GESAMTEN Key inkl. `-----BEGIN PRIVATE KEY-----` und `-----END PRIVATE KEY-----`

7. Klicke **"Save"**

8. **Wiederhole für Node "Status aktualisieren"**:
   - Klicke auf Node **"Status aktualisieren"**
   - Wähle bei Credentials: **"Firebase EisFavorite"** (die gerade erstellte)

---

### **Schritt 6: Gmail-Credentials in n8n einrichten**

1. Klicke auf Node **"E-Mail senden"**
2. Bei **"Credential to connect with"** → Klicke **"Create New"**
3. **WICHTIG**: Wähle **"Gmail OAuth2 API"** (NICHT "Service Account"!)
4. Es öffnet sich ein Fenster:

**Option A: OAuth2 (Empfohlen)**
- Klicke **"Connect my account"**
- Wähle **eisfavorit@gmail.com**
- Erlaube n8n Zugriff
- ✅ Fertig!

**Option B: App-Passwort (Falls OAuth nicht funktioniert)**
- Name: **"Gmail EisFavorite"**
- E-Mail: **eisfavorit@gmail.com**
- App-Passwort: **[Das 16-stellige Passwort von Schritt 3]**
- Klicke **"Save"**

---

### **Schritt 7: Workflow testen**

1. Klicke oben rechts auf **"Execute Workflow"** (Play-Button ▶️)
2. Der Workflow läuft durch alle Nodes
3. Prüfe die Ausgabe:
   - **Node "Filtere: 24h vor Event"**:
     Zeigt Anzahl gefundener Events an
   - Falls Events gefunden → E-Mail wird versendet!

**Debug-Modus:**
- Klicke auf jeden Node um die Daten zu sehen
- Grüne Häkchen = erfolgreich ✅
- Rote X = Fehler ❌

---

### **Schritt 8: Workflow aktivieren**

1. Oben rechts: Schalter **"Active"** auf **ON** 🟢
2. **FERTIG!** Der Workflow läuft jetzt automatisch täglich um 9:00 Uhr

---

## 📊 So funktioniert es im Detail

### Täglicher Ablauf (9:00 Uhr):

1. **9:00 Uhr**: Workflow startet automatisch
2. **Firebase**: Alle Buchungen werden geladen
3. **Filter**: Events werden geprüft:
   - Status = "Gebucht" ✅
   - E-Mail ODER Telefon vorhanden ✅
   - Noch keine Erinnerung gesendet ✅
   - Event findet in 20-28 Stunden statt ✅

4. **Für jedes gefundene Event:**
   - **Mit E-Mail**: E-Mail wird versendet 📧
     - BCC-Kopie an eisfavorit@gmail.com
     - Firebase: `emailReminderSent: true`
   - **Nur mit Telefon**: SMS wird versendet 📱
     - Firebase: `smsReminderSent: true`

5. **Auf der Karte** erscheint:
   - Badge "📧 ERINNERUNG" (bei E-Mail)
   - Badge "📱 ERINNERUNG" (bei SMS)

### Beispiel-E-Mail:

```
Betreff: Erinnerung: Ihr EisFavorite Termin morgen

Hallo Max Mustermann,

dies ist eine freundliche Erinnerung an Ihren EisFavorite Termin morgen:

📅 Datum: 23.07.2026
🕐 Uhrzeit: 14:00 Uhr
🏢 Firma: Musterfirma GmbH
📍 Adresse: Hauptstraße 10, 12345 München
👥 Gäste: 50
🍦 Kugeln pro Gast: 2

Wir freuen uns auf Sie! Ist noch alles in Ordnung mit dem Termin?

Bei Fragen oder Änderungen melden Sie sich gerne.

Viele Grüße,
Ihr EisFavorite Team 🍦

eisfavorit@gmail.com
```

---

## 🎯 UI-Features

### Dashboard
- **Lila Karte**: "24h-Erinnerungen fällig"
- Zeigt Anzahl der Events morgen (mit E-Mail oder Telefon)
- **Klickbar**: Springt zur gefilterten Ansicht

### Buchungsübersicht
- **Badge "📧 ERINNERUNG"**: Erscheint wenn E-Mail versendet wurde
- **Badge "📱 ERINNERUNG"**: Erscheint wenn SMS versendet wurde
- **Filter**: `?filter=reminders` zeigt alle fälligen Erinnerungen
- **Goldener Hinweis**: Im Filter-Header sichtbar

---

## 📱 SMS-Erinnerungen mit Twilio einrichten (Optional)

Falls Kunden keine E-Mail-Adresse haben, kann das System automatisch eine SMS senden.

### **Schritt 1: Twilio-Account erstellen**

1. Gehe zu: **https://www.twilio.com/**
2. Klicke **"Sign up"** (kostenloser Test-Account)
3. Verifiziere deine E-Mail und Telefonnummer
4. Du erhältst **Test-Credits** (ca. 15 €) kostenlos!

### **Schritt 2: Twilio-Telefonnummer besorgen**

1. Im Twilio Dashboard → **Phone Numbers**
2. Klicke **"Get a Number"**
3. Wähle ein Land (z.B. Deutschland: +49)
4. Wähle eine Nummer mit **SMS-Capability**
5. Klicke **"Choose this Number"**

**Kosten:**
- Nummer: ca. 1 € / Monat
- SMS: ca. 0,06 € pro SMS

### **Schritt 3: API-Credentials kopieren**

1. Im Twilio Dashboard → **Account Info**
2. Kopiere:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. Kopiere deine **Phone Number**: `+49xxxxxxxxxx`

### **Schritt 4: Twilio in n8n einrichten**

1. Öffne n8n Workflow
2. Klicke auf Node **"SMS senden (Twilio)"**
3. Bei **"Credential to connect with"** → Klicke **"Create New"**
4. Name: **"Twilio EisFavorite"**
5. **Account SID**: [Aus Schritt 3 einfügen]
6. **Auth Token**: [Aus Schritt 3 einfügen]
7. Klicke **"Save"**

8. **Wichtig**: Trage deine Twilio-Nummer ein:
   - Im Node **"SMS senden (Twilio)"**
   - Feld **"From Number"**: `+49xxxxxxxxxx`

### **Schritt 5: SMS-Nachricht anpassen (Optional)**

Der SMS-Text ist kürzer als die E-Mail (SMS-Limit: 160 Zeichen):

```
Hallo {{ $json.name }}, Erinnerung an Ihren EisFavorite Termin morgen:
📅 {{ $json.date }} um {{ $json.time }} Uhr
📍 {{ $json.street }}, {{ $json.plz }} {{ $json.city }}
Alles ok? Bei Fragen: eisfavorit@gmail.com
Ihr EisFavorite Team 🍦
```

Du kannst den Text im Node **"SMS senden (Twilio)"** → Feld **"Message"** anpassen.

### **Wichtig: Test-Modus vs. Live-Modus**

**Test-Modus** (mit Test-Credits):
- SMS werden NUR an **verifizierte Nummern** gesendet
- Du musst Kunden-Nummern erst in Twilio verifizieren
- Gut für Tests!

**Live-Modus** (nach Upgrade):
- SMS werden an ALLE Nummern gesendet
- Keine Verifizierung nötig
- Upgrade: **Account Settings** → **Upgrade Account**

---

## 🔧 Anpassungen & Einstellungen

### Zeitpunkt ändern (statt 9:00 Uhr):

1. In n8n: Klicke auf Node **"Täglich um 9:00 Uhr"**
2. Ändere **"Cron Expression"**:
   - `0 8 * * *` = 8:00 Uhr
   - `0 10 * * *` = 10:00 Uhr
   - `0 18 * * *` = 18:00 Uhr
3. Klicke **"Save"**

### E-Mail-Text anpassen:

1. Klicke auf Node **"E-Mail senden"**
2. Bearbeite **"Message"**-Feld
3. Variablen verfügbar:
   - `{{ $json.name }}` = Kundenname
   - `{{ $json.date }}` = Datum
   - `{{ $json.time }}` = Uhrzeit
   - `{{ $json.company }}` = Firma
   - `{{ $json.gaeste }}` = Gästeanzahl
   - `{{ $json.kugeln }}` = Kugeln pro Gast
   - `{{ $json.street }}`, `{{ $json.plz }}`, `{{ $json.city }}` = Adresse

4. Klicke **"Save"**

### Mehrmals täglich prüfen:

1. Ändere **"Cron Expression"** zu:
   - `0 */3 * * *` = Alle 3 Stunden
   - `0 9,15,18 * * *` = Um 9:00, 15:00 und 18:00 Uhr

---

## ⚠️ Häufige Probleme & Lösungen

### Problem: "Firebase authentication failed"
**Lösung:**
- Prüfe ob Service Account korrekt kopiert wurde
- Private Key muss KOMPLETT sein (inkl. BEGIN/END)
- Stelle sicher, dass Project ID richtig ist: `mailfavorite-e8f49`

### Problem: "Gmail: Authentication failed"
**Lösung:**
- Prüfe ob 2-Faktor-Authentifizierung aktiv ist
- Erstelle neues App-Passwort
- Kopiere Passwort ohne Leerzeichen: `xxxxxxxxxxxxxxxx`

### Problem: "No bookings found"
**Lösung:**
- Prüfe ob Firebase Zugriff funktioniert
- Teste mit "Execute Workflow"
- Schaue in Debug-Ausgabe von "Alle Buchungen laden"

### Problem: E-Mail wird nicht versendet
**Lösung:**
- Prüfe ob Event wirklich in 20-28h stattfindet
- Status muss "Gebucht" sein
- E-Mail-Adresse muss vorhanden sein
- `emailReminderSent` darf nicht `true` sein

---

## 📈 Monitoring & Logs

### In n8n:
1. Linkes Menü → **"Executions"**
2. Hier siehst du alle Ausführungen:
   - ✅ Grün = Erfolgreich
   - ❌ Rot = Fehler
3. Klicke auf eine Execution um Details zu sehen

### Im Dashboard:
- Lila Karte zeigt Anzahl fälliger Erinnerungen
- Klicke drauf → Siehst du alle Events

### In Buchungsübersicht:
- Badge "🔔 ERINNERUNG" = E-Mail wurde versendet
- Kein Badge = Noch nicht versendet

---

## 🎊 Zusammenfassung

**Was du jetzt hast:**
✅ Automatische 24h-Erinnerungs-E-Mails
✅ Automatische 24h-Erinnerungs-SMS (optional, falls keine E-Mail)
✅ Täglich um 9:00 Uhr
✅ Nur für Events mit Status "Gebucht"
✅ BCC-Kopie an eisfavorit@gmail.com (bei E-Mails)
✅ Automatische Markierung in Firebase (`emailReminderSent` / `smsReminderSent`)
✅ Sichtbar im Dashboard & Buchungsübersicht
✅ Vollautomatisch - keine manuelle Arbeit mehr!

**Kosten:**
- n8n: 0€ (2.500 Executions/Monat kostenlos)
- Twilio SMS (optional): ca. 1€/Monat + 0,06€ pro SMS

---

## 🆘 Support

Bei Problemen:
1. **n8n Docs**: https://docs.n8n.io/
2. **n8n Community**: https://community.n8n.io/
3. **Firebase Docs**: https://firebase.google.com/docs

---

**Viel Erfolg! 🍦🚀**
