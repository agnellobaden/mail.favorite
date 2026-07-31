#!/usr/bin/env node
/**
 * EisFavorite: Automatischer Versand der 24h-Event-Erinnerung (E-Mail)
 *
 * Prüft alle Buchungen mit Status "Gebucht", deren Termin (booking.date,
 * Format TT.MM.JJJJ) morgen stattfindet, und verschickt - falls noch nicht
 * geschehen (emailReminderSent) - dieselbe Erinnerungs-Mail wie der manuelle
 * "24h Erinnerung (E-Mail)"-Button in buchungen-uebersicht.html.
 *
 * Die SMS-Variante wird hier bewusst NICHT automatisiert: der manuelle
 * Button öffnet nur die native SMS-App auf dem Gerät (sms:-Link), es gibt
 * im Projekt keine SMS-Versand-API/Zugangsdaten. SMS bleibt daher weiterhin
 * manuell über die Buchungsübersicht.
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

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: config.gmailAppPassword }
});

// Date -> "TT.MM.JJJJ" (gleiches Format wie booking.date in der Buchungsübersicht)
function toGermanDateStr(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: Automatischer Versand der 24h-Erinnerung (E-Mail)');
    console.log('='.repeat(60));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toGermanDateStr(tomorrow);
    console.log(`Suche Termine am ${tomorrowStr} mit Status "Gebucht"...`);

    const snapshot = await db.collection('buchungen')
        .where('status', '==', 'Gebucht')
        .where('date', '==', tomorrowStr)
        .get();

    console.log(`${snapshot.size} Buchung(en) für morgen gefunden.`);

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const booking = doc.data();
        const bookingId = doc.id;

        if (booking.emailReminderSent) {
            console.log(`  ⏭ ${bookingId} (${booking.name || '-'}): Erinnerung bereits versendet.`);
            skipped++;
            continue;
        }

        if (!booking.email) {
            console.log(`  ⚠️ ${bookingId} (${booking.name || '-'}): keine E-Mail-Adresse hinterlegt - übersprungen.`);
            skipped++;
            continue;
        }

        const subject = 'Ihre Eiswagen-Buchung für morgen!';
        const text = `Hallo ${booking.name || ''},\n\nwir freuen uns sehr auf Ihr Event morgen am ${booking.date || ''} um ${booking.time || ''} Uhr!\n\nDas EisFavorite Team wird pünktlich vor Ort sein.\n\nViele Grüße,\nIhr EisFavorite Team`;

        try {
            await transporter.sendMail({
                from: `Eis Agnello <${EMAIL}>`,
                to: booking.email,
                subject: subject,
                text: text
            });

            const nowIso = new Date().toISOString();
            const nowDe = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

            await doc.ref.update({
                emailReminderSent: true,
                emailHistory: admin.firestore.FieldValue.arrayUnion({
                    timestamp: nowIso,
                    direction: 'sent',
                    subject: subject,
                    message: text
                }),
                aktualisiertAm: nowDe,
                lastModified: nowIso,
                lastModifiedMs: Date.now()
            });

            console.log(`  ✓ 24h-Erinnerung an ${booking.email} gesendet (${booking.name || '-'}, Termin ${booking.date} ${booking.time || ''}).`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Fehler beim Senden an ${booking.email} (${bookingId}):`, err.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${sent} Erinnerung(en) versendet, ${skipped} Buchung(en) übersprungen.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim automatischen 24h-Erinnerungs-Versand:', err);
    process.exit(1);
});
