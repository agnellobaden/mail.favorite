# EmailJS Setup - Automatischer E-Mail-Versand mit PDF-Anhang

## So richtest du EmailJS ein (KOSTENLOS):

### Schritt 1: EmailJS-Konto erstellen
1. Gehe zu: https://www.emailjs.com/
2. Klicke auf "Sign Up" (kostenlos)
3. Bestätige deine E-Mail-Adresse

### Schritt 2: E-Mail-Service verbinden
1. Gehe zu "Email Services"
2. Klicke "Add New Service"
3. Wähle **Gmail**
4. Verbinde dein Gmail-Konto (eisfavorit@gmail.com)
5. Kopiere die **Service ID** (z.B. "service_abc123")

### Schritt 3: E-Mail-Template erstellen
1. Gehe zu "Email Templates"
2. Klicke "Create New Template"
3. Verwende diesen Template-Code:

```
An: {{to_email}}
BCC: {{bcc_email}}
Betreff: {{subject}}

{{message}}
```

4. Füge unter "Attachments" hinzu:
   - Variable: `{{attachment}}`
   - Filename: `{{filename}}`
   - Content Type: `application/pdf`
   - Encoding: `base64`

5. Kopiere die **Template ID** (z.B. "template_xyz789")

### Schritt 4: Public Key holen
1. Gehe zu "Account" → "General"
2. Kopiere deinen **Public Key** (z.B. "pk_12345...")

### Schritt 5: Keys in rechnung-erstellen.html eintragen

Öffne `rechnung-erstellen.html` und ersetze in Zeile 1296 und 1308:

```javascript
emailjs.init('DEIN_PUBLIC_KEY_HIER');  // Zeile 1296
...
await emailjs.send('DEINE_SERVICE_ID', 'DEINE_TEMPLATE_ID', templateParams);  // Zeile 1308
```

**Beispiel:**
```javascript
emailjs.init('pk_12345abcdefg');
...
await emailjs.send('service_abc123', 'template_xyz789', templateParams);
```

### Schritt 6: Speichern und testen!

Jetzt sendet deine App automatisch E-Mails mit PDF-Anhang!

## Kosten
- **KOSTENLOS**: Bis zu 200 E-Mails pro Monat
- Perfekt für dein Eisgeschäft!

## Vorteile
✅ PDF wird automatisch angehängt
✅ Direkt aus dem Browser
✅ Kein Server notwendig
✅ BCC an eisfavorit@gmail.com automatisch
✅ Professionelle E-Mails

## Support
Probleme? Schreib mir oder schau auf: https://www.emailjs.com/docs/
