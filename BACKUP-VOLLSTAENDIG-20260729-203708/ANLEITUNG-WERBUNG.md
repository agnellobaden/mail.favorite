# 📢 Werbung / Firmen-Akquise – Setup-Anleitung

Automatisierte B2B-Kaltakquise für EisFavorite: findet Firmen und Schulen im
50km-Umkreis von Kuppenheim, sammelt Kontaktdaten (Adresse, Telefon, E-Mail)
und schreibt sie alle 4 Wochen mit wechselnden Slogans an, bis sie buchen
oder absagen.

## Überblick

| Teil | Datei | Zweck |
|---|---|---|
| Flyer / Landingpage | `flyer-firmen.html` | Wird per E-Mail verlinkt, Button führt zu eisfavorite.de |
| Werbung-Übersicht | `werbung.html` | Firmenliste mit Status, erreichbar über das Burger-Menü in buchungen-uebersicht.html |
| n8n-Workflow 1 | `n8n-workflow-werbung-firmensuche.json` | Sucht Firmen über Google Places API, speichert sie in Firebase |
| n8n-Workflow 2 | `n8n-workflow-werbung-kampagne.json` | Läuft alle 4 Wochen, verschickt Werbe-E-Mails mit rotierendem Slogan |
| n8n-Workflow 3 | `n8n-workflow-werbung-flyer-email.json` | Alternative/ungenutzte Variante über n8n - **wird aktuell nicht mehr verwendet**, siehe unten |

Alle Daten liegen in der Firestore-Collection **`marketingLeads`** (gleiches
Firebase-Projekt `mailfavorite-e8f49` wie die Buchungen).

## Voraussetzungen

1. **Google Cloud Projekt mit Places API**
   - [Google Cloud Console](https://console.cloud.google.com/) → Projekt anlegen/wählen
   - "Places API" aktivieren (Places API **New** oder **Legacy** – die Workflows
     nutzen die klassischen Endpunkte `nearbysearch` und `details`)
   - API-Key erstellen, Abrechnung aktivieren (Places API ist kostenpflichtig,
     hat aber ein monatliches Gratis-Guthaben)
   - **Wichtig:** Key in der Cloud Console auf die Places API einschränken

2. **n8n** (Cloud oder selbst gehostet), bereits vorhanden für die 24h-Erinnerungen

3. **Firebase Service Account** – dieselben Credentials, die bereits für den
   24h-Erinnerungs-Workflow eingerichtet sind (siehe `ANLEITUNG-24H-ERINNERUNGEN.md`)

4. **Gmail-Zugang** (eisfavorit@gmail.com) – ebenfalls bereits vorhanden

## Einrichtung Schritt für Schritt

### 1. Workflows importieren

In n8n: **Workflows → Import from File** für beide Dateien:
- `n8n-workflow-werbung-firmensuche.json`
- `n8n-workflow-werbung-kampagne.json`

### 2. Credentials verknüpfen

In beiden Workflows bei jedem Firebase-Node und beim Gmail-Node die
bestehenden Credentials auswählen (ersetzt die Platzhalter
`DEINE_FIREBASE_CREDENTIALS` / `DEINE_GMAIL_CREDENTIALS`).

### 3. Google Places API-Key hinterlegen

Die Workflows lesen den Key über `{{ $env.GOOGLE_PLACES_API_KEY }}`. In n8n:
- **Selbst gehostet:** Umgebungsvariable `GOOGLE_PLACES_API_KEY` in der n8n-Konfiguration
  (`.env` bzw. Docker-Compose) setzen und n8n neu starten
- **n8n Cloud:** In den Workflow-Einstellungen → Variables (falls verfügbar) oder
  ersatzweise den Ausdruck in den beiden "Google Places"-HTTP-Request-Nodes durch
  den Key direkt ersetzen (dann nicht ins Git-Repo mit echtem Key committen!)

### 4. Firmensuche-Webhook mit werbung.html verbinden

1. Workflow "EisFavorite: Firmensuche" **aktivieren**
2. Im Webhook-Node die **Production URL** kopieren
3. In `werbung.html` auf **"⚙️ n8n-Webhook einrichten"** klicken und die URL einfügen
   (wird lokal im Browser gespeichert)
4. Ab jetzt startet der Button **"🔍 Firmensuche starten"** in werbung.html die Suche

### 5. Kampagne aktivieren

Workflow "EisFavorite: Werbe-Kampagne für Firmen" **aktivieren** – läuft danach
automatisch alle 4 Wochen um 9:00 Uhr.

### 6. Automatischen Gmail-Versand einrichten (einmalig)

Der n8n-Webhook-Weg (`n8n-workflow-werbung-flyer-email.json`) hat sich in der
Praxis als zu fehleranfällig gezeigt (405-Fehler, Setup-Aufwand). Stattdessen
verschickt die App E-Mails jetzt **automatisch im Hintergrund direkt aus dem
Browser** über die Gmail-API (kein Compose-Fenster, kein manueller Klick auf
"Senden") - das gilt für den Flyer-Versand in `werbung.html` **und** für den
Chat im Buchungsformular in `buchungen-uebersicht.html`. Beide nutzen dieselbe
gemeinsame Anbindung in `js/gmail-api.js`, daher ist die Einrichtung nur
**einmal** nötig:

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt
   **mailfavorite-e8f49** auswählen (dasselbe wie für Firebase)
2. **APIs & Dienste → Bibliothek** → **"Gmail API"** suchen → **Aktivieren**
3. **APIs & Dienste → OAuth-Zustimmungsbildschirm**:
   - Nutzertyp **"Extern"**, App-Name z.B. "EisFavorite Werbung"
   - Unter **"Testnutzer"** die E-Mail-Adresse **eisfavorit@gmail.com**
     hinzufügen (so lange die App nicht von Google verifiziert ist, dürfen
     nur eingetragene Testnutzer sie benutzen - reicht für den Eigenbedarf)
4. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**:
   - Anwendungstyp **"Webanwendung"**
   - Bei **"Autorisierte JavaScript-Quellen"** eintragen:
     `https://maileisfavorite.vercel.app`
   - Erstellen, die **Client-ID** kopieren (endet auf `.apps.googleusercontent.com`)
5. In `js/gmail-api.js` nach `GMAIL_OAUTH_CLIENT_ID` suchen und den Platzhalter
   durch die kopierte Client-ID ersetzen (gilt dann automatisch für alle Seiten)
6. Fertig: Firmen/Schulen per Häkchen auswählen → **"📧 Flyer an Ausgewählte
   senden"** → im Dialog jede E-Mail als Vorschau ansehen und mit **"📧 Jetzt
   per Gmail senden"** bestätigen. Beim allerersten Versand öffnet sich ein
   Google-Anmeldefenster - dort **eisfavorit@gmail.com** auswählen und den
   Versand erlauben (nur einmal pro Browser-Sitzung nötig)

## Wie die Firmensuche funktioniert

- Sucht per Google Places **Nearby Search** im 50km-Radius um Kuppenheim
  (48.8386, 8.2933 – das ist das API-Maximum für den Radius)
- Läuft mehrere Kategorien durch (Handwerk, Büros, Handel, Verwaltung, Schulen
  aller Art, …) – die Liste steht im Node "Suchkategorien erzeugen" und lässt
  sich dort erweitern
- Holt für jeden Treffer per **Place Details** Adresse, Telefonnummer und Website
- Berechnet zusätzlich die **Luftlinien-Entfernung zu Kuppenheim** (`distanceKm`)
  aus den von Google gelieferten Koordinaten - **Mitarbeiterzahlen liefert
  Google Places dagegen grundsätzlich nicht**, dieses Feld bleibt bei
  automatisch gefundenen Firmen leer, außer man trägt es manuell nach
- Ruft die Website ab und **sucht per Regex eine E-Mail-Adresse** im HTML
  (klappt nicht bei jeder Seite – manche haben nur Kontaktformulare ohne
  sichtbare E-Mail-Adresse, dann bleibt das Feld leer)
- Speichert alles in Firestore, **ohne** den Status bestehender Leads zu
  überschreiben (ein einmal auf "gebucht" gesetzter Lead bleibt "gebucht")

**Hinweis zur Abdeckung:** Die Places API liefert maximal 60 Treffer pro
Suchanfrage (Google-Limit). Bei sehr dichten Gebieten wird also nicht
zwangsläufig *jede* Firma gefunden. Bei Bedarf lässt sich die Kategorienliste
im n8n-Editor erweitern oder die Suche in mehrere kleinere Radien um
verschiedene Orte im Umkreis aufteilen.

## Wie die Kampagne funktioniert

- Läuft alle 4 Wochen
- Schreibt nur Leads an, die noch **nicht "gebucht"** oder **"abgelehnt"** sind
  und deren letzter Kontakt (falls vorhanden) **mindestens 4 Wochen** her ist
- Jeder Lead hat einen `sloganIndex` – bei jedem Versand wird der nächste
  Slogan aus der rotierenden Liste verwendet (8 Slogans hinterlegt, danach
  beginnt die Liste wieder von vorn)
- Die E-Mail enthält immer den Button/Link zu **eisfavorite.de** für die
  Anfrage sowie einen Opt-out-Hinweis ("Kein Interesse" antworten)

## Rechtlicher Hinweis (wichtig!)

Automatisierte B2B-Kaltakquise per E-Mail ist in Deutschland nicht ohne
Weiteres uneingeschränkt zulässig (UWG, DSGVO). Ein paar Punkte, die du
beachten solltest:

- Nur an **allgemeine Firmen-E-Mail-Adressen** (info@, kontakt@) schreiben,
  keine privaten Adressen
- **Absender klar erkennbar** halten (ist durch Impressum-Angaben in der
  E-Mail bereits gegeben)
- **Opt-out ernst nehmen** – wer "Kein Interesse" antwortet, sollte manuell
  auf Status "abgelehnt" gesetzt werden, damit die Kampagne ihn nicht mehr
  anschreibt
- Bei Unsicherheit: kurz anwaltlich absichern lassen, bevor die Kampagne im
  großen Stil läuft

## Wiederherstellung / Anpassung

- Slogans ändern: Node "Fällige Leads filtern & Slogan wählen" im
  Kampagnen-Workflow bearbeiten
- Such-Radius/Zentrum ändern: Node "Suchkategorien erzeugen" im
  Firmensuche-Workflow bearbeiten
- Flyer-Text/Design ändern: `flyer-firmen.html` direkt bearbeiten
