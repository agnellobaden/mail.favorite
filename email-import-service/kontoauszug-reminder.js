#!/usr/bin/env node
/**
 * EisFavorite: Wöchentliche Erinnerung "Kontoauszug einholen".
 *
 * Verschickt eine kurze E-Mail an den Inhaber (nicht an Kunden), die daran
 * erinnert, den aktuellen Sparkassen-Kontoauszug (CSV-CAMT V2) herunterzuladen
 * und in kontoauszug.html zu importieren/kategorisieren - damit Steuerreport
 * und Buchhaltungsordner-Ansicht aktuell bleiben.
 *
 * Läuft per Windows-Aufgabenplanung einmal pro Woche (siehe
 * run-kontoauszug-reminder.bat).
 *
 * Benötigt dieselbe config.json wie send-payment-reminders.js:
 *   { "gmailAppPassword": "..." }
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CONFIG_PATH = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ config.json fehlt.');
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const SENDER_EMAIL = 'eisfavorit@gmail.com';
const RECIPIENT_EMAIL = 'eisfavorit@gmail.com';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SENDER_EMAIL, pass: config.gmailAppPassword }
});

const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

const mailOptions = {
    from: `EisFavorite <${SENDER_EMAIL}>`,
    to: RECIPIENT_EMAIL,
    subject: '🏦 Erinnerung: Neuen Kontoauszug einholen',
    text: `Hallo,

wöchentliche Erinnerung (${today}): Bitte den aktuellen Kontoauszug von der Sparkasse herunterladen und importieren.

So geht's:
1. Sparkassen-Onlinebanking öffnen -> Umsätze -> Exportieren -> "Excel (CSV-CAMT V2)"
2. Datei herunterladen
3. Auf kontoauszug.html hochladen ("CSV-Datei auswählen")
4. Neue Buchungen kurz durchsehen und ggf. auf "Privat" umstellen (Standard ist "Geschäftsausgabe")

Damit bleiben Steuerreport und Buchhaltungsordner-Ansicht aktuell.

- EisFavorite App`
};

transporter.sendMail(mailOptions)
    .then(() => {
        console.log(`✅ Erinnerungs-E-Mail gesendet an ${RECIPIENT_EMAIL} (${today}).`);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Fehler beim Senden:', err.message);
        process.exit(1);
    });
