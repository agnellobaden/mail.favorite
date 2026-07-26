# 🔒 Login-Schutz eingerichtet – das musst du noch selbst tun

## Was jetzt schon fertig ist (im Code)

Alle Seiten, die du selbst benutzt (Buchungsübersicht, Dashboard, Strichliste,
Angebot/Rechnung erstellen, Preise verwalten, Werbung, Freier Verkauf) sind
jetzt mit einem Login geschützt. Ohne Anmeldung wird man automatisch zu
`login.html` weitergeleitet.

**Aber:** Das allein schützt deine Daten noch NICHT wirklich! Der Login in
der App ist nur die "Tür" – die Datenbank selbst (Firestore) hat noch die
alten, offenen Regeln (`allow read, write: if true`). Das heißt: Jeder, der
deinen API-Key kennt (der steht sichtbar im Programmcode), könnte die
Datenbank bisher trotzdem direkt anzapfen, am Login vorbei.

**Deshalb sind jetzt zwei Schritte in der Firebase Console nötig, die ich
nicht für dich erledigen kann** (ich habe keinen Zugriff auf dein
Firebase-Konto):

---

## Schritt 1: E-Mail/Passwort-Login aktivieren

1. Gehe zu [Firebase Console](https://console.firebase.google.com/) → Projekt **mailfavorite-e8f49**
2. Links im Menü: **Authentication** → Tab **Sign-in method**
3. Klicke auf **E-Mail/Passwort** → **Aktivieren** → Speichern

## Schritt 2: Dein Konto einmalig einrichten

1. Öffne `login.html` in deiner App (z.B. `deine-domain.de/login.html`)
2. Klicke auf **"Noch kein Konto? Einmalig einrichten"**
3. Trage ein: E-Mail **eisfavorit@gmail.com** und ein Passwort deiner Wahl
   (mind. 6 Zeichen) – **das ist wichtig, es MUSS genau diese E-Mail-Adresse
   sein**, siehe Schritt 3
4. Klicke auf "Konto erstellen" – du wirst automatisch angemeldet

## Schritt 3: Firestore-Regeln verschärfen (der eigentliche Schutz!)

1. Firebase Console → **Firestore Database** → Tab **Regeln**
2. Ersetze den kompletten Inhalt durch:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email == "eisfavorit@gmail.com";
    }
  }
}
```

3. Klicke auf **Veröffentlichen**

Ab jetzt kann NUR NOCH jemand, der mit genau der E-Mail-Adresse
`eisfavorit@gmail.com` angemeldet ist, überhaupt lesen oder schreiben –
egal wer sonst den API-Key kennt oder ob jemand auf `login.html` versucht,
sich mit einer anderen E-Mail ein Konto anzulegen.

---

## Wichtig zu wissen

- **Auf jedem Gerät einmal anmelden:** Handy, PC, Tablet – überall einmal
  mit `eisfavorit@gmail.com` + deinem Passwort einloggen. Danach bleibt man
  angemeldet (wie bei den meisten Apps), bis man sich aktiv abmeldet.
- **Abmelden:** Burger-Menü (☰) → "🚪 Abmelden"
- **Passwort vergessen:** Aktuell gibt es noch keine "Passwort vergessen"-
  Funktion in `login.html` – falls gewünscht, kann ich die ergänzen
  (Firebase kann automatisch eine Reset-E-Mail verschicken)
- **Reihenfolge wichtig:** Mach Schritt 1 und 2 **bevor** du Schritt 3
  (Regeln verschärfen) machst – sonst kannst du dich nicht mehr anmelden,
  weil dein Konto noch gar nicht existiert!
- Falls nach Schritt 3 etwas "Permission denied" meldet: Prüfe, ob du
  wirklich mit `eisfavorit@gmail.com` angemeldet bist (nicht mit einer
  anderen Google-Mail, falls du mehrere hast)
