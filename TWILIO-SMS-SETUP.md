# 📱 Automatische SMS-Versendung - Setup-Anleitung

## 🎯 Was ist neu?

Das System kann jetzt **automatisch SMS versenden** - ohne dass Sie manuell die SMS-App öffnen müssen!

## 💰 Kosten

- **0,075€ pro SMS** nach Deutschland
- **Keine monatliche Grundgebühr**
- **10€ Startguthaben** beim Registrieren (ca. 130 SMS kostenlos!)

---

## 🚀 Setup in 5 Minuten

### Schritt 1: Twilio-Account erstellen

1. Gehen Sie zu: **https://www.twilio.com/try-twilio**
2. Registrieren Sie sich (kostenlos)
3. Bestätigen Sie Ihre E-Mail-Adresse
4. Bestätigen Sie Ihre Telefonnummer

### Schritt 2: Zugangsdaten kopieren

Nach der Registrierung sehen Sie Ihr Dashboard:

1. **Account SID** kopieren (sieht aus wie: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
2. **Auth Token** kopieren (sieht aus wie: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
3. Klicken Sie auf "Get a trial phone number" → **Telefonnummer kopieren** (z.B. `+4915735983484`)

### Schritt 3: Zugangsdaten eintragen

Öffnen Sie die Datei `buchungen-uebersicht.html` und suchen Sie nach Zeile **2781-2785**:

```javascript
const TWILIO_CONFIG = {
    accountSid: 'IHRE_ACCOUNT_SID_HIER',  // ← Hier einfügen!
    authToken: 'IHR_AUTH_TOKEN_HIER',      // ← Hier einfügen!
    fromNumber: '+4915735983484'           // ← Hier einfügen!
};
```

**Beispiel nach dem Eintragen:**
```javascript
const TWILIO_CONFIG = {
    accountSid: 'AC1234567890abcdef1234567890abcd',
    authToken: 'abcd1234efgh5678ijkl9012mnop3456',
    fromNumber: '+4915735983484'
};
```

### Schritt 4: Datei speichern

Speichern Sie die Datei und laden Sie die Seite neu!

---

## ✅ So funktioniert es

### Option 1: Alle SMS auf einmal senden

1. Klicken Sie auf die Dashboard-Karte **"📱 SMS SENDEN"**
2. Klicken Sie oben auf **"🚀 ALLE X SMS AUTOMATISCH SENDEN"**
3. Bestätigen Sie → SMS werden automatisch versendet!

### Option 2: Einzelne SMS senden

1. Klicken Sie auf die Dashboard-Karte **"📱 SMS SENDEN"**
2. Klicken Sie bei einem Kunden auf **"🚀 AUTOMATISCH SENDEN"**
3. SMS wird sofort versendet!

### Option 3: Manuell (wie bisher)

Falls Sie die SMS manuell über Ihre SMS-App senden möchten:
1. Klicken Sie auf **"📱 Manuell (SMS-App)"**
2. SMS-App öffnet sich mit vorgefertigtem Text

---

## 🔒 Sicherheit

**WICHTIG:** Ihre Twilio-Zugangsdaten sind wie ein Passwort!

- ✅ **Lokal auf Ihrem PC**: Sicher
- ✅ **Auf Vercel (privates Deployment)**: Sicher, solange nur Sie Zugriff haben
- ❌ **Öffentlich im Internet**: NICHT sicher!

**Empfehlung:**
- Für Tests: Zugangsdaten direkt im Code (wie oben)
- Für Produktion: Firebase Cloud Functions nutzen (fragen Sie mich, wenn Sie das brauchen)

---

## 🧪 Trial-Modus

Beim kostenlosen Twilio-Account gilt:

- ✅ SMS an **verifizierte Nummern** senden (kostenlos!)
- ❌ SMS an **nicht-verifizierte Nummern** werden blockiert

### Nummer verifizieren:

1. Twilio Dashboard → "Phone Numbers" → "Verified Caller IDs"
2. Klicken Sie auf "+" → Telefonnummer eingeben
3. Code per SMS erhalten → Eingeben
4. ✅ Jetzt können Sie SMS an diese Nummer senden!

### Upgrade auf Produktiv-Modus (empfohlen):

1. Twilio Dashboard → "Upgrade"
2. Zahlungsinformationen hinterlegen
3. ✅ Jetzt können Sie SMS an **ALLE** Nummern senden!
4. Sie zahlen nur **0,075€ pro SMS** - keine Grundgebühr

---

## 📊 Kostenbeispiele

| SMS-Anzahl | Kosten |
|------------|--------|
| 10 SMS     | 0,75€  |
| 50 SMS     | 3,75€  |
| 100 SMS    | 7,50€  |
| 200 SMS    | 15,00€ |

**Hinweis:** Mit dem 10€ Startguthaben können Sie ca. **130 SMS** kostenlos versenden!

---

## ❓ Häufige Fragen

### "SMS wird nicht versendet - Fehlercode 21211"
➡️ **Lösung:** Telefonnummer ist ungültig. Prüfen Sie, ob die Telefonnummer des Kunden korrekt ist.

### "Fehlercode 20003"
➡️ **Lösung:** Twilio-Zugangsdaten sind falsch. Überprüfen Sie Account SID und Auth Token.

### "Fehlercode 21606"
➡️ **Lösung:** Absender-Telefonnummer ist ungültig. Überprüfen Sie die "fromNumber" in der Konfiguration.

### "SMS geht nicht an Kunden XY"
➡️ **Lösung:** Im Trial-Modus müssen Sie zuerst die Nummer verifizieren (siehe oben). ODER upgraden Sie zu einem produktiven Account.

### "Ich will das kostenlos - ohne Twilio"
➡️ **Antwort:** Leider nicht möglich. SMS-Versand kostet immer Geld, da Mobilfunkanbieter Gebühren verlangen. Twilio ist bereits einer der günstigsten Anbieter (0,075€/SMS).

---

## 🆘 Support

Bei Problemen:
1. Öffnen Sie die Browser-Konsole (F12)
2. Schauen Sie nach Fehlermeldungen (rot markiert)
3. Kopieren Sie die Fehlermeldung
4. Suchen Sie in dieser Anleitung nach der Lösung

---

## ✨ Vorteile der automatischen SMS

✅ **Zeitersparnis**: Keine manuelle SMS-Erstellung mehr
✅ **Zuverlässig**: SMS werden garantiert versendet
✅ **Tracking**: System merkt sich, wer bereits eine SMS erhalten hat
✅ **Automatisch**: Einfach auf "SENDEN" klicken - fertig!
✅ **Professionell**: Immer derselbe Text, keine Tippfehler

---

## 🎉 Los geht's!

1. Twilio-Account erstellen
2. Zugangsdaten eintragen
3. Speichern & neu laden
4. **"📱 SMS SENDEN"** anklicken
5. **SMS automatisch versenden!**

Viel Erfolg! 🚀
