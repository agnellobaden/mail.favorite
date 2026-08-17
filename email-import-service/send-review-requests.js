#!/usr/bin/env node
/**
 * EisFavorite: Automatischer Versand von Bewertungsanfragen
 *
 * Prüft alle Buchungen mit Status "Event beendet", deren Termin
 * (booking.date, Format TT.MM.JJJJ) genau REVIEW_REQUEST_DELAY_DAYS Tage
 * zurückliegt, und verschickt - falls noch nicht geschehen
 * (reviewRequestSent) - eine freundliche Mail mit Bitte um eine
 * Google-Bewertung.
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
const REVIEW_LINK = 'https://www.google.com/maps?cid=3902340462103007003';

// Wie viele Tage nach dem Event die Bewertungsanfrage rausgeht - bewusst ein
// paar Tage Abstand, damit der Eindruck noch frisch, aber der Stress vom
// Eventtag selbst schon vorbei ist.
const REVIEW_REQUEST_DELAY_DAYS = 2;

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

const DRY_RUN = process.argv.includes('--preview');

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: ' + (DRY_RUN ? 'VORSCHAU (kein Versand)' : 'Automatischer Versand') + ' von Bewertungsanfragen');
    console.log('='.repeat(60));

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - REVIEW_REQUEST_DELAY_DAYS);
    const targetDateStr = toGermanDateStr(targetDate);
    console.log(`Suche Events am ${targetDateStr} (vor ${REVIEW_REQUEST_DELAY_DAYS} Tagen) mit Status "Event beendet"...`);

    const snapshot = await db.collection('buchungen')
        .where('status', '==', 'Event beendet')
        .where('date', '==', targetDateStr)
        .get();

    console.log(`${snapshot.size} Buchung(en) gefunden.`);

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const booking = doc.data();
        const bookingId = doc.id;

        if (booking.reviewRequestSent) {
            console.log(`  ⏭ ${bookingId} (${booking.name || '-'}): Bewertungsanfrage bereits versendet.`);
            skipped++;
            continue;
        }

        if (!booking.email) {
            console.log(`  ⚠️ ${bookingId} (${booking.name || '-'}): keine E-Mail-Adresse hinterlegt - übersprungen.`);
            skipped++;
            continue;
        }

        const displayName = booking.company || booking.name || '';

        if (DRY_RUN) {
            console.log(`  📧 WÜRDE senden an: ${booking.email} (${displayName}, Event vom ${booking.date})`);
            sent++;
            continue;
        }

        const subject = 'Wie war\'s? Wir freuen uns über Ihre Bewertung! 🍦';
        const text = `Hallo ${displayName},\n\n` +
            `vielen Dank, dass wir bei Ihrem Event dabei sein durften! Wir hoffen, es hat allen geschmeckt.\n\n` +
            `Es würde uns riesig freuen, wenn Sie sich eine Minute Zeit nehmen und uns eine kurze Google-Bewertung hinterlassen:\n\n` +
            `${REVIEW_LINK}\n\n` +
            `Das hilft uns sehr und anderen bei der Entscheidung für ihr eigenes Event.\n\n` +
            `Viele Grüße,\nIhr EisFavorite Team`;

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
                reviewRequestSent: true,
                reviewRequestSentDate: nowDe,
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

            console.log(`  ✓ Bewertungsanfrage an ${booking.email} gesendet (${displayName}, Event vom ${booking.date}).`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Fehler beim Senden an ${booking.email} (${bookingId}):`, err.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${sent} Bewertungsanfrage(n) ${DRY_RUN ? 'würden versendet werden' : 'versendet'}, ${skipped} Buchung(en) übersprungen.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim automatischen Bewertungsanfrage-Versand:', err);
    process.exit(1);
});
