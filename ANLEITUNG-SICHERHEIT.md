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

## Schritt 1: Login aktivieren

Du kannst dich entweder mit **Google** oder mit **E-Mail/Passwort** anmelden
(beides ist in der App eingebaut) – **Google ist empfohlen**, da kein
zusätzliches Passwort nötig ist.

1. Gehe zu [Firebase Console](https://console.firebase.google.com/) → Projekt **mailfavorite-e8f49**
2. Links im Menü: **Authentication** → Tab **Sign-in method**
3. **Google** anklicken → **Aktivieren** → Speichern
   (E-Mail/Passwort kannst du zusätzlich aktivieren, falls gewünscht)

## Schritt 2: Anmelden

1. Öffne `login.html` in deiner App
2. Klicke auf **"Mit Google anmelden"**
3. Wähle im Google-Fenster das Konto **eisfavorit@gmail.com** aus
   (falls es das erste Mal ist, evtl. kurz Berechtigung bestätigen)
4. Du wirst automatisch weitergeleitet – fertig, kein Passwort nötig

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
  mit "Mit Google anmelden" + Konto `eisfavorit@gmail.com` auswählen. Danach
  bleibt man angemeldet (wie bei den meisten Apps), bis man sich aktiv abmeldet.
- **Abmelden:** Burger-Menü (☰) → "🚪 Abmelden"
- **Reihenfolge wichtig:** Mach Schritt 1 und 2 **bevor** du Schritt 3
  (Regeln verschärfen) machst – sonst könntest du dich danach ggf. nicht
  mehr anmelden!
- Falls nach Schritt 3 etwas "Permission denied" meldet: Prüfe, ob du
  wirklich mit `eisfavorit@gmail.com` angemeldet bist (nicht mit einer
  anderen Google-Mail, falls du mehrere hast)
