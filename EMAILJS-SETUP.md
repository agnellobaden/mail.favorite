# 📧 Automatische E-Mail-Versendung - Setup-Anleitung

## 🎯 Was ist neu?

Das System kann jetzt **automatisch E-Mails versenden** - ohne dass Sie Gmail öffnen müssen!

## 💰 Kosten

- **100% KOSTENLOS** bis 200 E-Mails pro Monat
- Keine Kreditkarte erforderlich
- Keine versteckten Kosten

---

## 🚀 Setup in 10 Minuten

### Schritt 1: EmailJS-Account erstellen

1. Gehen Sie zu: **https://www.emailjs.com**
2. Klicken Sie auf **"Sign Up"** (Registrieren)
3. Registrieren Sie sich mit Ihrer E-Mail-Adresse
4. Bestätigen Sie Ihre E-Mail-Adresse

---

### Schritt 2: E-Mail-Service hinzufügen

Nach der Registrierung:

1. Klicken Sie im Dashboard auf **"Add New Service"**
2. Wählen Sie **"Gmail"** aus (oder einen anderen E-Mail-Anbieter)
3. Klicken Sie auf **"Connect Account"**
4. Melden Sie sich mit Ihrem Gmail-Konto an (z.B. eisfavorit@gmail.com)
5. Erlauben Sie EmailJS den Zugriff
6. **Kopieren Sie die "Service ID"** (z.B. `service_abc1234`)

---

### Schritt 3: E-Mail-Template erstellen

1. Klicken Sie im Dashboard auf **"Email Templates"**
2. Klicken Sie auf **"Create New Template"**
3. **Template Name:** `Terminerinnerung`
4. **Einfügen Sie diesen Text in das Template:**

```
Betreff: Erinnerung: Ihr Termin morgen bei EisFavorite

Hallo {{customer_name}}!

Dies ist eine freundliche Erinnerung an Ihren Termin morgen. Der Termin steht noch und ich komme wie vereinbart.

📅 Datum: {{event_date}}
🕐 Uhrzeit: {{event_time}}
🏢 Bei: {{company}}
📍 Adresse: {{full_address}}

{{message}}

Falls Sie Fragen haben, melden Sie sich gerne!

Viele Grüße
Ihr EisFavorite Team 🍦

---
EisFavorite - Eiswagen für Events
Telefon: [Ihre Telefonnummer]
E-Mail: eisfavorit@gmail.com
```

5. Klicken Sie auf **"Save"**
6. **Kopieren Sie die "Template ID"** (z.B. `template_xyz5678`)

---

### Schritt 4: Public Key kopieren

1. Klicken Sie im Dashboard auf **"Account"** → **"General"**
2. Scrollen Sie zu **"API Keys"**
3. **Kopieren Sie den "Public Key"** (z.B. `user_abcdefghijklmnop`)

---

### Schritt 5: Zugangsdaten eintragen

Öffnen Sie die Datei `buchungen-uebersicht.html` und suchen Sie nach **Zeile 2781-2785**:

```javascript
const EMAILJS_CONFIG = {
    publicKey: 'IHRE_PUBLIC_KEY_HIER',     // ← Hier einfügen!
    serviceId: 'IHR_SERVICE_ID_HIER',      // ← Hier einfügen!
    templateId: 'IHR_TEMPLATE_ID_HIER'     // ← Hier einfügen!
};
```

**Beispiel nach dem Eintragen:**
```javascript
const EMAILJS_CONFIG = {
    publicKey: 'user_abcdefghijklmnop',
    serviceId: 'service_abc1234',
    templateId: 'template_xyz5678'
};
```

---

### Schritt 6: Datei speichern & testen!

1. Speichern Sie die Datei
2. Laden Sie die Seite neu
3. Klicken Sie auf **"📧 E-MAIL SENDEN"**
4. Klicken Sie auf **"🚀 AUTOMATISCH SENDEN"**
5. ✅ E-Mail wird automatisch versendet!

---

## ✅ So funktioniert es

### Option 1: Alle E-Mails auf einmal senden

1. Klicken Sie auf die Dashboard-Karte **"📧 E-MAIL SENDEN"**
2. Klicken Sie oben auf **"🚀 ALLE X E-MAILS AUTOMATISCH SENDEN"**
3. Bestätigen Sie → E-Mails werden automatisch versendet!

### Option 2: Einzelne E-Mail senden

1. Klicken Sie auf die Dashboard-Karte **"📧 E-MAIL SENDEN"**
2. Klicken Sie bei einem Kunden auf **"🚀 AUTOMATISCH SENDEN"**
3. E-Mail wird sofort versendet!

---

## 📧 E-Mail-Inhalt

Die Kunden erhalten folgende E-Mail:

```
Betreff: Erinnerung: Ihr Termin morgen bei EisFavorite

Hallo [Name]!

Dies ist eine freundliche Erinnerung an Ihren Termin morgen.
Der Termin steht noch und ich komme wie vereinbart.

📅 Datum: 20.07.2026
🕐 Uhrzeit: 14:00 Uhr
🏢 Bei: Firma XY
📍 Adresse: Straße 1, 12345 Stadt

Falls Sie Fragen haben, melden Sie sich gerne!

Viele Grüße
Ihr EisFavorite Team 🍦
```

---

## ❓ Häufige Fragen

### "E-Mail wird nicht versendet"
➡️ **Lösung:** Überprüfen Sie:
- Public Key korrekt eingetragen?
- Service ID korrekt eingetragen?
- Template ID korrekt eingetragen?
- Internet-Verbindung vorhanden?
- Browser-Konsole (F12) für Fehlermeldungen prüfen

### "Fehler: Invalid public key"
➡️ **Lösung:** Public Key ist falsch. Kopieren Sie ihn erneut aus dem EmailJS Dashboard → Account → General → API Keys

### "Fehler: Template does not exist"
➡️ **Lösung:** Template ID ist falsch. Kopieren Sie sie erneut aus dem EmailJS Dashboard → Email Templates

### "Fehler: Service does not exist"
➡️ **Lösung:** Service ID ist falsch. Kopieren Sie sie erneut aus dem EmailJS Dashboard → Email Services

### "Ich habe die 200 E-Mails/Monat überschritten"
➡️ **Lösung:**
1. Warten Sie bis zum nächsten Monat (kostenlos)
2. ODER upgraden Sie auf einen bezahlten Plan (ab $9/Monat für 1.000 E-Mails)

---

## ✨ Vorteile der automatischen E-Mail-Versendung

✅ **Zeitersparnis**: Keine manuelle E-Mail-Erstellung mehr
✅ **Zuverlässig**: E-Mails werden garantiert versendet
✅ **Tracking**: System merkt sich, wer bereits eine E-Mail erhalten hat
✅ **Automatisch**: Einfach auf "SENDEN" klicken - fertig!
✅ **Professionell**: Immer derselbe Text, keine Tippfehler
✅ **Kostenlos**: Bis 200 E-Mails/Monat komplett gratis!

---

## 🎉 Los geht's!

1. EmailJS-Account erstellen auf https://www.emailjs.com
2. Service, Template und Public Key erstellen
3. Zugangsdaten eintragen (Zeile 2781-2785 in buchungen-uebersicht.html)
4. Speichern & neu laden
5. **"📧 E-MAIL SENDEN"** anklicken
6. **E-Mails automatisch versenden!**

Viel Erfolg! 🚀
