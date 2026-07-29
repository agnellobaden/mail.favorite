# 🚀 n8n Integration für EisFavorite - Komplette Automatisierung

## 📋 Übersicht

Mit **n8n** (Workflow-Automatisierung) kannst du folgende Prozesse **vollautomatisch** ablaufen lassen:

1. ✅ **E-Mail-Import**: Gmail → Automatische Datenextraktion → Firebase
2. ✅ **24h-Erinnerungen**: Automatische E-Mails 24h vor Event
3. ✅ **Zahlungserinnerungen**: Automatische Mahnungen bei überfälligen Rechnungen
4. ✅ **Statusbenachrichtigungen**: Benachrichtigungen bei neuen Buchungen
5. ✅ **CSV-Backup**: Tägliche automatische Backups

---

## 🎯 Vorteile gegenüber Python-Script

| Python email_importer.py | n8n Workflow |
|-------------------------|--------------|
| ❌ Manuelles Ausführen | ✅ Vollautomatisch |
| ❌ Windows Task Scheduler kompliziert | ✅ Integrierter Scheduler |
| ❌ Kein visueller Editor | ✅ Drag & Drop Editor |
| ❌ Fehlersuche schwierig | ✅ Debug-Modus mit Logging |
| ❌ Nur E-Mail-Import | ✅ Unbegrenzte Workflows |

---

## 🛠️ Setup: n8n installieren

### Option 1: n8n Cloud (Einfachste Methode)

1. Gehe zu: **https://n8n.io/**
2. Klicke auf **"Start for free"**
3. Erstelle ein kostenloses Konto
4. ✅ **Fertig!** n8n läuft in der Cloud

**Kosten:**
- Kostenlos: 2.500 Workflow-Ausführungen/Monat
- Perfekt für dein Geschäft!

### Option 2: Selbst hosten (Fortgeschritten)

```bash
# Mit Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n

# Oder mit npm
npm install n8n -g
n8n start
```

Öffne dann: **http://localhost:5678**

---

## 📧 Workflow 1: Automatischer E-Mail-Import (Gmail → Firebase)

### Schritt-für-Schritt Anleitung:

1. **Neuen Workflow erstellen** in n8n
2. **Trigger hinzufügen**: "Gmail Trigger"
3. **Gmail verbinden**:
   - E-Mail: `eisfavorit@gmail.com`
   - App-Passwort erstellen (wie bei Python-Script)
   - Label: UNREAD
   - Trigger: Jede Minute prüfen

4. **Datenextraktion** mit "Function" Node:

```javascript
// FUNCTION NODE: E-Mail Daten extrahieren
const emailBody = $input.item.json.snippet || $input.item.json.payload?.body?.data || '';
const subject = $input.item.json.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
const from = $input.item.json.payload?.headers?.find(h => h.name === 'From')?.value || '';
const fullText = subject + '\n' + emailBody;

// Regex-Extraktion (gleich wie Python-Script)
function extract(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(new RegExp(pattern, 'i'));
    if (match) return match[1]?.trim();
  }
  return '';
}

// Extrahiere alle Felder
const booking = {
  id: 'booking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  status: 'Neu',
  name: extract(fullText, [
    'Name:?\\s*([A-ZÄÖÜa-zäöüß\\s]+(?:\\s+[A-ZÄÖÜa-zäöüß]+)+)',
    'Von:?\\s*([A-ZÄÖÜa-zäöüß\\s]+(?:\\s+[A-ZÄÖÜa-zäöüß]+)+)'
  ]) || extract(from, ['([A-ZÄÖÜa-zäöüß\\s]+)']),

  email: extract(fullText, [
    'E-?Mail:?\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
    '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
  ]),

  phone: extract(fullText, [
    'Tel(?:efon)?:?\\s*(\\+?[0-9\\s\\-\\(\\)\\/]+)',
    'Mobil:?\\s*(\\+?[0-9\\s\\-\\(\\)\\/]+)'
  ]),

  company: extract(fullText, [
    'Firma:?\\s*([A-ZÄÖÜa-zäöüß0-9\\s&\\.\\-]+)'
  ]),

  date: extract(fullText, [
    'Datum:?\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})',
    'Termin:?\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})',
    'am\\s+(\\d{1,2}\\.\\d{1,2}\\.\\d{4})'
  ]),

  time: extract(fullText, [
    'Uhrzeit:?\\s*(\\d{1,2}:\\d{2})',
    'um\\s+(\\d{1,2}:\\d{2})',
    '(\\d{1,2}:\\d{2})\\s*Uhr'
  ]),

  timeEnd: '',

  guests: extract(fullText, [
    'Gäste:?\\s*(\\d+)',
    'Personen:?\\s*(\\d+)',
    '(\\d+)\\s+Gäste'
  ]),

  kugelPerGuest: '',
  location: '',

  street: extract(fullText, [
    'Straße:?\\s*([A-ZÄÖÜa-zäöüß\\s]+\\d+[a-z]?)',
    'Adresse:?\\s*([A-ZÄÖÜa-zäöüß\\s]+\\d+[a-z]?)'
  ]),

  plz: extract(fullText, [
    'PLZ:?\\s*(\\d{5})',
    '(\\d{5})\\s+[A-ZÄÖÜa-zäöüß]'
  ]),

  city: extract(fullText, [
    'Stadt:?\\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+)',
    '\\d{5}\\s+([A-ZÄÖÜa-zäöüß][a-zäöüß]+)'
  ]),

  distance: '',
  wunschsorten: extract(fullText, [
    'Sorten?:?\\s*([A-ZÄÖÜa-zäöüß\\s,\\-]+)',
    'Geschmack:?\\s*([A-ZÄÖÜa-zäöüß\\s,\\-]+)',
    'Wunsch:?\\s*([A-ZÄÖÜa-zäöüß\\s,\\-]+)'
  ]),

  notizen: emailBody.substring(0, 500),
  eigeneNotizen: 'Automatisch importiert via n8n am ' + new Date().toLocaleString('de-DE'),

  angebotUrl: '',
  angebotVorlage: '',
  rechnungUrl: '',
  invoiceNumber: '',
  invoiceAmount: '',
  invoicePaid: false,
  invoiceSent: false,
  emailReminderSent: false,

  erstelltAm: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  aktualisiertAm: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  lastModified: new Date().toISOString(),
  lastModifiedMs: Date.now(),

  _email_subject: subject,
  _email_from: from
};

return { json: booking };
```

5. **Firebase Node hinzufügen**:
   - Operation: **Set**
   - Collection: `bookings`
   - Document ID: `{{ $json.id }}`
   - Fields: **Alle Felder aus booking-Objekt**

6. **Firebase Credentials erstellen**:
   - Gehe zu Firebase Console: https://console.firebase.google.com/
   - Project: `mailfavorite-e8f49`
   - Gehe zu **Project Settings** → **Service Accounts**
   - Klicke **"Generate new private key"**
   - Lade die JSON-Datei herunter
   - In n8n: Füge **Firebase Service Account** hinzu
   - Kopiere den Inhalt der JSON-Datei

7. **Gmail als "gelesen" markieren** (Optional):
   - Füge **Gmail** Node hinzu
   - Operation: **"Add Label"** oder **"Mark as Read"**
   - Message ID: `{{ $('Gmail Trigger').item.json.id }}`

8. **Aktivieren**: Schalte Workflow auf **"Active"**

### 🎉 Fertig!

Ab jetzt werden **alle neuen E-Mails automatisch**:
1. Von Gmail abgerufen
2. Daten extrahiert
3. Direkt in Firebase gespeichert
4. Sofort auf allen Geräten sichtbar!

---

## ⏰ Workflow 2: 24h-Erinnerungen (Automatische E-Mails)

### Was macht dieser Workflow?

Sendet **automatisch E-Mails** an Kunden **24 Stunden vor dem Event**, z.B.:

```
Betreff: Erinnerung: Ihr EisFavorite Termin morgen

Hallo Max Mustermann,

dies ist eine freundliche Erinnerung an Ihren EisFavorite Termin:

📅 Datum: 22.07.2026
🕐 Uhrzeit: 14:00 Uhr
📍 Adresse: Hauptstraße 10, 12345 München

Wir freuen uns auf Sie!

Viele Grüße,
Ihr EisFavorite Team 🍦
```

### Setup:

1. **Neuen Workflow erstellen**
2. **Schedule Trigger**:
   - Interval: **Every hour** (jede Stunde prüfen)
   - ODER: **Cron**: `0 9 * * *` (täglich um 9:00 Uhr)

3. **Firebase Node** (Daten abrufen):
   - Operation: **Get All**
   - Collection: `bookings`
   - Return All: `true`

4. **Function Node** (Filter: 20-28h vor Event):

```javascript
// Filtere Buchungen die in 20-28h stattfinden
const now = new Date();
const bookings = $input.all().map(item => item.json);

const toRemind = bookings.filter(booking => {
  // Nur "Gebucht" Status
  if (booking.status !== 'Gebucht') return false;

  // Nur wenn E-Mail vorhanden
  if (!booking.email) return false;

  // Nur wenn noch keine Erinnerung gesendet
  if (booking.emailReminderSent === true) return false;

  // Berechne Stunden bis Event
  if (!booking.date) return false;
  const [day, month, year] = booking.date.split('.');
  const eventDate = new Date(year, month - 1, day);

  if (booking.time) {
    const [hours, minutes] = booking.time.split(':');
    eventDate.setHours(hours, minutes);
  }

  const hoursUntil = (eventDate - now) / (1000 * 60 * 60);

  // 20-28 Stunden Fenster (täglich laufen lassen!)
  return hoursUntil >= 20 && hoursUntil <= 28;
});

return toRemind.map(b => ({ json: b }));
```

5. **Gmail Node** (E-Mail senden):
   - Operation: **Send Email**
   - To: `{{ $json.email }}`
   - BCC: `eisfavorit@gmail.com` (Kopie an dich)
   - Subject: `Erinnerung: Ihr EisFavorite Termin morgen`
   - Message:

```
Hallo {{ $json.name }},

dies ist eine freundliche Erinnerung an Ihren EisFavorite Termin:

📅 Datum: {{ $json.date }}
🕐 Uhrzeit: {{ $json.time }} Uhr
📍 Adresse: {{ $json.street }}, {{ $json.plz }} {{ $json.city }}

Wir freuen uns auf Sie!

Viele Grüße,
Ihr EisFavorite Team 🍦
```

6. **Firebase Node** (Status aktualisieren):
   - Operation: **Update**
   - Collection: `bookings`
   - Document ID: `{{ $json.id }}`
   - Fields:
     - `emailReminderSent`: `true`
     - `lastModified`: `{{ new Date().toISOString() }}`
     - `lastModifiedMs`: `{{ Date.now() }}`

7. **Aktivieren**: Schalte auf **"Active"**

### 🎉 Fertig!

Ab jetzt werden **automatisch E-Mails versendet** 24h vor jedem Event!

---

## 📊 Workflow 3: Überfällige Rechnungen (Automatische Mahnungen)

### Setup:

1. **Schedule Trigger**: Täglich um 10:00 Uhr
   - Cron: `0 10 * * *`

2. **Firebase**: Get All bookings

3. **Function Node** (Filter überfällige Rechnungen):

```javascript
const now = new Date();
const bookings = $input.all().map(item => item.json);

const overdue = bookings.filter(booking => {
  // Rechnung versendet aber nicht bezahlt
  if (!booking.invoiceSent || booking.invoicePaid) return false;

  // Datum in der Vergangenheit
  if (!booking.date) return false;
  const [day, month, year] = booking.date.split('.');
  const eventDate = new Date(year, month - 1, day);

  // Event ist vorbei + mindestens 7 Tage her
  const daysAgo = (now - eventDate) / (1000 * 60 * 60 * 24);

  return daysAgo >= 7;
});

return overdue.map(b => ({ json: b }));
```

4. **Gmail Node**: Zahlungserinnerung senden

5. **Firebase**: `paymentReminderCount` erhöhen

---

## 🔔 Workflow 4: Neue Buchung → Push-Benachrichtigung

### Setup:

1. **Firebase Trigger**:
   - Collection: `bookings`
   - Trigger: **Document Created**

2. **Function Node**: Formatiere Nachricht

```javascript
const booking = $input.item.json;
const message = `🍦 Neue Buchung!
Name: ${booking.name}
Datum: ${booking.date} ${booking.time}
Gäste: ${booking.guests}`;

return { json: { message } };
```

3. **Telegram/Slack/Discord** Node:
   - Sende Benachrichtigung auf dein Handy!

---

## 💾 Workflow 5: Tägliches CSV-Backup

### Setup:

1. **Schedule**: Täglich um 23:00 Uhr

2. **Firebase**: Get All bookings

3. **Function**: Konvertiere zu CSV

```javascript
const bookings = $input.all().map(item => item.json);

const csv = [
  'ID,Status,Name,E-Mail,Telefon,Datum,Uhrzeit,Gäste,Stadt,Rechnung',
  ...bookings.map(b => [
    b.id,
    b.status,
    b.name,
    b.email,
    b.phone,
    b.date,
    b.time,
    b.guests,
    b.city,
    b.invoiceNumber
  ].join(','))
].join('\n');

return { json: { csv, filename: `backup-${new Date().toISOString().split('T')[0]}.csv` } };
```

4. **Google Drive** Node:
   - Speichere CSV automatisch in Google Drive
   - ODER: **Dropbox** / **OneDrive**

---

## 📋 Zusammenfassung: Dein Automatisierungs-Setup

| Workflow | Trigger | Aktion | Vorteil |
|----------|---------|--------|---------|
| **E-Mail-Import** | Jede Minute | Gmail → Firebase | ✅ Keine manuelle Arbeit |
| **24h-Erinnerung** | Täglich 9:00 | E-Mail an Kunden | ✅ Kunden zufriedener |
| **Zahlungserinnerung** | Täglich 10:00 | Mahnung senden | ✅ Schnellere Zahlungen |
| **Neue Buchung** | Bei neuem Dokument | Push-Benachrichtigung | ✅ Sofort informiert |
| **CSV-Backup** | Täglich 23:00 | Upload zu Drive | ✅ Datensicherheit |

---

## 🎓 n8n Tutorials

### Offizielles n8n Handbuch:
- **https://docs.n8n.io/**

### Video-Tutorials:
- **YouTube**: "n8n Tutorial für Anfänger"
- **n8n Templates**: https://n8n.io/workflows/

### Community:
- **Forum**: https://community.n8n.io/
- **Discord**: https://discord.gg/n8n

---

## 🔒 Sicherheit & Best Practices

### Firebase Service Account:
- ✅ **Nur in n8n speichern** (nicht in Git!)
- ✅ Regelmäßig Keys rotieren
- ✅ Minimale Berechtigungen verwenden

### Gmail App-Passwort:
- ✅ Separates App-Passwort nur für n8n
- ✅ 2-Faktor-Authentifizierung aktiviert

### n8n Cloud:
- ✅ Alle Credentials verschlüsselt gespeichert
- ✅ SSL/TLS für alle Verbindungen

---

## 💰 Kosten-Übersicht

### n8n Cloud (Empfohlen):
- **Starter**: 0€ (2.500 Executions/Monat)
- **Pro**: 20€/Monat (25.000 Executions/Monat)

### Geschätzte Executions für dein Business:
- E-Mail-Import: ~40/Tag = 1.200/Monat
- 24h-Erinnerungen: ~30/Monat
- Zahlungserinnerungen: ~30/Monat
- Backups: ~30/Monat
- **GESAMT**: ~1.300/Monat

➡️ **Kostenloser Plan reicht völlig aus!** 🎉

---

## 🚀 Nächste Schritte

1. ✅ Erstelle n8n Cloud Account
2. ✅ Verbinde Gmail (App-Passwort)
3. ✅ Erstelle Firebase Service Account
4. ✅ Importiere Workflow 1 (E-Mail-Import)
5. ✅ Teste mit einer E-Mail
6. ✅ Aktiviere alle anderen Workflows
7. ✅ **Fertig! System läuft vollautomatisch** 🎊

---

## 📞 Support

Bei Fragen:
1. Prüfe die **n8n Docs**: https://docs.n8n.io/
2. Schaue **n8n Templates**: https://n8n.io/workflows/
3. Frage in der **n8n Community**: https://community.n8n.io/

---

**Viel Erfolg mit der Automatisierung! 🍦🚀**
