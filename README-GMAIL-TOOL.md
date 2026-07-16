# 🍦 Gmail Export Tool für EisFavorite

Automatisches Extrahieren von Buchungsanfragen aus Gmail und Export als JSON für die Buchungsverwaltung.

## ⚡ Schnellstart (Windows)

1. **Doppelklick auf `INSTALL.bat`** - Installiert alle benötigten Pakete
2. **Folge der Anleitung in `SETUP.md`** - Gmail API einrichten
3. **Doppelklick auf `START.bat`** - Tool starten

## 📋 Was macht das Tool?

Das Tool:
- ✅ Verbindet sich mit deinem Gmail-Account (`eisfavorit@gmail.com`)
- ✅ Durchsucht E-Mails nach Buchungsanfragen
- ✅ Extrahiert automatisch:
  - Name & E-Mail-Adresse
  - Telefonnummer
  - Datum & Uhrzeit
  - Gästeanzahl
  - Adresse (Straße, PLZ, Stadt)
  - Firma/Company
  - Veranstaltungsort
  - Wunschsorten (bis zu 3)
  - Notizen
- ✅ Exportiert alles als JSON-Datei
- ✅ Markiert importierte E-Mails automatisch als "Neu eingetroffen!"

## 📊 Intelligente Daten-Extraktion

Das Tool erkennt automatisch:

### 📞 Telefonnummern
```
"Tel: 0123456789"
"Telefon: +49 123 456789"
"Handy: 0170 1234567"
```

### 📅 Datumsformate
```
"15.08.2026"
"15. August 2026"
"2026-08-15"
```

### 🏢 Firmen
```
"Musterfirma GmbH"
"Event AG"
"Party-Service UG"
```

### 📍 Adressen
```
"Hauptstraße 123, 76456 Kuppenheim"
"Am Marktplatz 5"
"76456 Baden-Baden"
```

### 👥 Gästeanzahl
```
"50 Gäste"
"für 100 Personen"
"ca. 75 Leute"
```

### 🍦 Eissorten
```
"Vanille, Schokolade, Erdbeere"
"Wir hätten gerne Pistazie"
```

## 🔍 Such-Optionen

Beim Start des Tools kannst du wählen:

1. **Alle E-Mails der letzten 30 Tage**
   - Holt alle E-Mails der letzten 30 Tage

2. **Nur ungelesene E-Mails**
   - Perfekt für neue Anfragen

3. **E-Mails mit Stichwort**
   - z.B. "Buchung", "Anfrage", "Hochzeit"

4. **Benutzerdefinierte Suche**
   - Verwende Gmail-Suchoperatoren
   - z.B. `from:kunde@beispiel.de after:2026/07/01`

## 📤 Export-Format

Das Tool erstellt eine JSON-Datei wie:
```
buchungen-export-2026-07-15-143022.json
```

Diese Datei kannst du direkt in die Buchungsverwaltung importieren!

## 🔐 Sicherheit

- ✅ Verwendet offizielle Gmail API
- ✅ OAuth 2.0 Authentifizierung
- ✅ Nur Lesezugriff auf E-Mails
- ✅ Credentials bleiben lokal auf deinem PC
- ✅ Google-zertifizierte Methode

## 📁 Dateien

```
mail.eisfavorite/
├── gmail-export-tool.py     # Hauptprogramm
├── requirements.txt          # Python-Abhängigkeiten
├── SETUP.md                  # Detaillierte Anleitung
├── README-GMAIL-TOOL.md      # Diese Datei
├── INSTALL.bat               # Installation (Windows)
├── START.bat                 # Tool starten (Windows)
├── credentials.json          # Gmail API Credentials (musst du erstellen)
└── token.json                # Wird automatisch erstellt
```

## 🆘 Probleme?

### "credentials.json nicht gefunden"
→ Folge der Anleitung in `SETUP.md` Schritt 3

### "Python nicht gefunden"
→ Installiere Python von https://www.python.org/downloads/

### "Keine E-Mails gefunden"
→ Versuche eine andere Suchoption

### Tool startet nicht
→ Führe `INSTALL.bat` erneut aus

## 🎯 Workflow

```
┌─────────────────┐
│  Gmail-Account  │
│ eisfavorit@...  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Gmail Export   │
│      Tool       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  JSON-Export    │
│  buchungen-...  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Buchungsverwaltung │
│  maileisfavorite   │
│    .vercel.app     │
└─────────────────┘
```

## 📚 Weitere Infos

- Gmail API Dokumentation: https://developers.google.com/gmail/api
- Gmail Suchoperatoren: https://support.google.com/mail/answer/7190
- Python Installation: https://www.python.org/downloads/

---

**Erstellt mit ❤️ für EisFavorite** 🍦
