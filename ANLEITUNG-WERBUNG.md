# 📢 Werbung / Firmen-Akquise – Setup-Anleitung

Automatisierte B2B-Kaltakquise für EisFavorite: findet Firmen im 50km-Umkreis von
Rastatt, sammelt Kontaktdaten und schreibt sie alle 4 Wochen mit wechselnden
Slogans an, bis sie buchen oder absagen.

## Überblick

| Teil | Datei | Zweck |
|---|---|---|
| Flyer / Landingpage | `flyer-firmen.html` | Wird per E-Mail verlinkt, Button führt zu eisfavorite.de |
| Werbung-Übersicht | `werbung.html` | Firmenliste mit Status, erreichbar über das Burger-Menü in buchungen-uebersicht.html |
| n8n-Workflow 1 | `n8n-workflow-werbung-firmensuche.json` | Sucht Firmen über Google Places API, speichert sie in Firebase |
| n8n-Workflow 2 | `n8n-workflow-werbung-kampagne.json` | Läuft alle 4 Wochen, verschickt Werbe-E-Mails mit rotierendem Slogan |

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

## Wie die Firmensuche funktioniert

- Sucht per Google Places **Nearby Search** im 50km-Radius um Rastatt
  (48.8592, 8.2043 – das ist das API-Maximum für den Radius)
- Läuft mehrere Kategorien durch (Handwerk, Büros, Handel, Verwaltung, …) –
  die Liste steht im Node "Suchkategorien erzeugen" und lässt sich dort erweitern
- Holt für jeden Treffer per **Place Details** Telefonnummer und Website
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
