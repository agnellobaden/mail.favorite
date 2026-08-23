#!/usr/bin/env node
/**
 * EisFavorite: Bestätigungsmail für Newsletter-Anmeldungen (Double-Opt-in)
 *
 * eisfavorite.de legt bei einer Newsletter-Anmeldung direkt aus dem Browser
 * einen Eintrag in Firestore an ("newsletterSubscribers", Status "pending",
 * Doc-ID = Bestätigungs-Token). Dieses Skript verschickt dafür per
 * Gmail-SMTP (dieselbe Anbindung wie send-review-requests.js /
 * send-payment-reminders.js - kostenlos, kein zusätzliches EmailJS-Template
 * nötig) die Bestätigungsmail mit dem Link, der die Anmeldung auf
 * "confirmed" setzt (siehe Firestore-Regeln: nur dieser eine Statuswechsel
 * ist unauthentifiziert erlaubt).
 *
 * Merkt sich mit "confirmationSentAt", welche Anmeldungen schon eine Mail
 * bekommen haben, damit bei jedem Lauf nur wirklich neue verschickt werden.
 *
 * Benötigt dieselben lokalen Dateien wie import.js:
 *   - config.json                    { "gmailAppPassword": "..." }
 *   - firebase-service-account.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ config.json fehlt. Bitte erst anlegen (siehe README.md in diesem Ordner).');
    process.exit(1);
}
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ firebase-service-account.json fehlt. Bitte erst anlegen (siehe README.md, Abschnitt "Einrichtung").');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
    });
}
const db = admin.firestore();

const EMAIL = 'eisfavorit@gmail.com';
const SITE_URL = 'https://www.eisfavorite.de';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: config.gmailAppPassword }
});

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: Newsletter-Bestätigungsmails');
    console.log('='.repeat(60));

    const snapshot = await db.collection('newsletterSubscribers')
        .where('status', '==', 'pending')
        .get();

    console.log(`${snapshot.size} ausstehende Anmeldung(en) gefunden.`);

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const subscriber = doc.data();
        const token = doc.id;

        if (subscriber.confirmationSentAt) {
            skipped++;
            continue;
        }

        if (!subscriber.email) {
            console.log(`  ⚠️ ${token}: keine E-Mail-Adresse - übersprungen.`);
            skipped++;
            continue;
        }

        const confirmLink = `${SITE_URL}/newsletter-bestaetigen?token=${token}`;
        const subject = 'Bitte bestätigen Sie Ihre Newsletter-Anmeldung';
        const text = `Hallo,\n\n` +
            `vielen Dank für Ihr Interesse an EisFavorite!\n\n` +
            `Bitte bestätigen Sie Ihre Newsletter-Anmeldung mit einem Klick auf diesen Link:\n\n` +
            `${confirmLink}\n\n` +
            `Falls Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail einfach - es passiert dann nichts weiter.\n\n` +
            `Ihr EisFavorite-Team`;

        try {
            await transporter.sendMail({
                from: `EisFavorite <${EMAIL}>`,
                to: subscriber.email,
                subject: subject,
                text: text
            });

            await doc.ref.update({
                confirmationSentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`  ✓ Bestätigungsmail an ${subscriber.email} gesendet.`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Fehler beim Senden an ${subscriber.email}:`, err.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${sent} Bestätigungsmail(s) versendet, ${skipped} übersprungen.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim Newsletter-Bestätigungsversand:', err);
    process.exit(1);
});
