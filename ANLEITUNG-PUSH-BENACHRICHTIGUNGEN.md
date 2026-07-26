# 🔔 Push-Benachrichtigungen einrichten – das musst du noch selbst tun

## Was jetzt schon fertig ist (im Code)

- Die App fragt im Burger-Menü ("🔔 Push-Benachrichtigungen aktivieren") nach
  der Erlaubnis für Benachrichtigungen und speichert den Geräte-Token in der
  neuen Firestore-Sammlung `pushTokens`.
- Der Service Worker (`sw.js`) kann Push-Nachrichten empfangen und anzeigen,
  auch wenn die App geschlossen ist.
- Eine n8n-Vorlage (`n8n-workflow-push-benachrichtigungen.json`) sendet Push-
  Nachrichten bei drei Ereignissen:
  1. **Neue Buchung/Anfrage** (prüft alle 5 Minuten)
  2. **24h-Erinnerung vor Termin** (täglich 9:00 Uhr, unabhängig von der
     bestehenden E-Mail/SMS-Erinnerung)
  3. **Zahlung eingegangen** (prüft alle 5 Minuten, wenn eine Rechnung als
     bezahlt markiert wird)

**Aber:** Push-Nachrichten brauchen einen "Absender", der beim Google-Dienst
Firebase Cloud Messaging (FCM) angemeldet ist. Das kann ich nicht für dich
einrichten (kein Zugriff auf dein Google-Konto/n8n). Es sind drei Schritte
nötig:

---

## Schritt 1: VAPID-Key erzeugen (im Browser-Code eintragen)

1. Öffne [Firebase Console](https://console.firebase.google.com/) → Projekt
   **mailfavorite-e8f49**
2. Zahnrad oben links → **Projekteinstellungen** → Tab **Cloud Messaging**
3. Ganz unten bei **Web-Push-Zertifikate** → **Schlüsselpaar generieren**
4. Den langen Schlüssel kopieren
5. In `buchungen-uebersicht.html` suchen nach:
   ```
   const VAPID_KEY = 'HIER_DEINEN_VAPID_KEY_EINTRAGEN';
   ```
   und den kopierten Schlüssel dort einsetzen, z.B.:
   ```
   const VAPID_KEY = 'BKx...dein-langer-key...';
   ```
6. Änderung committen/pushen (oder mir sagen, dass ich es einsetzen soll,
   sobald du den Schlüssel hast)

## Schritt 2: Google Service Account für n8n einrichten

n8n muss sich gegenüber Google ausweisen dürfen, um Push-Nachrichten über die
FCM-API zu verschicken.

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt
   **mailfavorite-e8f49** auswählen
2. **APIs & Dienste → Bibliothek** → nach **"Firebase Cloud Messaging API"**
   suchen → **Aktivieren** (falls noch nicht aktiv)
3. Falls du schon eine Service-Account-Datei für die bestehenden n8n-Firebase-
   Workflows hast (z.B. für den 24h-Reminder), kannst du dieselbe Datei
   wiederverwenden – sie braucht nur zusätzlich die Rolle
   **"Firebase Cloud Messaging API Admin"** (IAM & Verwaltung → IAM → Rolle
   beim Service-Account hinzufügen)
4. In n8n: **Credentials → New → Google API** (Service Account) → die JSON-
   Datei hochladen/einfügen → Name z.B. "Google Service Account (FCM)"

## Schritt 3: Workflow importieren und verknüpfen

1. In n8n: **Workflows → Import from File** → `n8n-workflow-push-
   benachrichtigungen.json` auswählen
2. Öffne jeden Firestore-Node (z.B. "Buchungen laden (neu)") und wähle deine
   bestehende **Firebase Service Account**-Credential aus (dieselbe wie beim
   24h-Reminder-Workflow)
3. Öffne jeden **"FCM senden (...)"**-Node und wähle die neue **Google
   Service Account (FCM)**-Credential aus Schritt 2
4. Workflow **speichern und aktivieren** (Schalter oben rechts)

---

## ⚠️ Wichtiger Hinweis zur Vorlage

Diesen Workflow konnte ich nur als Code schreiben, aber **nicht selbst in
n8n testen** (kein Zugriff auf deine n8n-Instanz). Es kann sein, dass du
nach dem Import kleine Anpassungen machen musst – z.B. falls dein n8n eine
andere Version der Firestore- oder HTTP-Request-Node-Parameter erwartet.
Schau nach dem Import einmal über die Nodes, bevor du aktivierst, und teste
mit **"Execute Workflow"** (einmalig manuell ausführen) ob alles durchläuft.

---

## Testen

1. Öffne die App, Burger-Menü → **"🔔 Push-Benachrichtigungen aktivieren"**
   → Erlauben antippen
2. Lege eine Test-Buchung mit Status "Neu" an
3. Nach spätestens 5 Minuten sollte eine Push-Benachrichtigung erscheinen
   (auch wenn die App/der Tab geschlossen ist)

## Häufige Fragen

**"Notification.requestPermission wurde nie gefragt"**
➡️ Push funktioniert nur über HTTPS (eure Vercel-URL), nicht bei lokal
geöffneten Dateien.

**"Ich sehe keine Pushes, obwohl der Workflow läuft"**
➡️ Prüfe in Firestore, ob unter `pushTokens` überhaupt Einträge stehen –
falls nicht, wurde die Erlaubnis nie erteilt oder der VAPID-Key fehlt noch.

**"FCM-Aufruf gibt einen 403/401-Fehler zurück"**
➡️ Meist fehlt die Rolle "Firebase Cloud Messaging API Admin" beim Service
Account, oder die API ist in Google Cloud noch nicht aktiviert (Schritt 2).
