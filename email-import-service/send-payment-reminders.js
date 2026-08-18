#!/usr/bin/env node
/**
 * EisFavorite: Automatischer Versand von Zahlungserinnerungen
 *
 * Prüft alle Buchungen mit versendeter, aber unbezahlter Rechnung
 * (invoiceSent === true, invoicePaid nicht true). Die erste Erinnerung geht
 * fest REMINDER_INTERVAL_DAYS (10 Tage) nach dem Rechnungsdatum
 * (booking.invoiceData.invoiceDate, Format TT.MM.JJJJ) automatisch raus -
 * bewusst unabhängig vom Zahlungsziel, auf ausdrücklichen Wunsch des
 * Inhabers. Wird per Gmail-SMTP an die Kunden-E-Mail verschickt - genau der
 * gleiche Text wie beim manuellen "Zahlungserinnerung senden"-Button in
 * rechnung-erstellen.html.
 *
 * Um Spam zu vermeiden, wird pro Buchung höchstens alle
 * REMINDER_INTERVAL_DAYS (10 Tage) erneut erinnert (siehe unten).
 *
 * Aktualisiert dieselben Firestore-Felder wie der manuelle Button
 * (paymentReminderSent/-Date/-Count) und schreibt einen Eintrag in
 * "zahlungserinnerungen" (taucht im Rechnungsarchiv als "Erinnerungen"
 * auf) - damit Buchungsübersicht und Rechnungsarchiv automatisch
 * versendete Erinnerungen genauso anzeigen wie manuell versendete.
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
const REMINDER_INTERVAL_DAYS = 10; // Mindestabstand zwischen zwei automatischen Erinnerungen

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: config.gmailAppPassword }
});

// "TT.MM.JJJJ" -> Date (lokale Zeit, Mitternacht)
function parseGermanDate(str) {
    if (!str) return null;
    const parts = str.trim().split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
}

function buildReminderEmail(booking, daysOverdue) {
    const invoiceNumber = booking.invoiceNumber || (booking.invoiceData && booking.invoiceData.invoiceNumber) || '';
    const totalBrutto = booking.invoiceAmount || '';
    const paymentDue = booking.invoiceData && booking.invoiceData.paymentDue || '';
    const recipient = (booking.invoiceData && booking.invoiceData.customerContact) || booking.contactPerson || booking.company || booking.name || 'Kunde/in';

    const subject = `Zahlungserinnerung - Rechnung ${invoiceNumber}`;
    const text = `Liebe/r ${recipient},

wir danken Ihnen nochmals für Ihren Auftrag und die schöne Veranstaltung.

Diese E-Mail ist eine freundliche Erinnerung bezüglich unserer Rechnung:

Rechnungsnummer: ${invoiceNumber}
Rechnungsbetrag: ${totalBrutto}
Zahlungsziel: ${paymentDue}

Sollten Sie die Rechnung bereits beglichen haben, betrachten Sie diese E-Mail bitte als gegenstandslos. Falls Sie die Zahlung noch nicht veranlasst haben, bitten wir Sie, den offenen Betrag zeitnah zu überweisen.

Unsere Bankverbindung:
Empfänger: Andrea Agnello
Bank: Sparkasse Baden Baden
IBAN: DE72 6625 0030 0030 4713 20
BIC/SWIFT: SOLADES1BAD
Verwendungszweck: Rechnung ${invoiceNumber}

Bei Fragen zur Rechnung oder falls es Probleme gibt, stehen wir Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr Eis Agnello Team

---
Eis Agnello
Favoritenstrasse 11
76456 Kuppenheim
Tel: +49 176 56813172`;

    return { subject, text };
}

async function archiveReminder(booking, bookingId, daysOverdue, reminderCount) {
    const invoiceNumber = booking.invoiceNumber || (booking.invoiceData && booking.invoiceData.invoiceNumber) || '';
    const docId = 'erinnerung-' + (invoiceNumber || 'ohne-nummer') + '-' + Date.now();
    await db.collection('zahlungserinnerungen').doc(docId).set({
        invoiceNumber: invoiceNumber,
        customerName: (booking.invoiceData && booking.invoiceData.customerCompany) || booking.company || booking.name || '',
        email: booking.email || '',
        amount: booking.invoiceAmount || '',
        paymentDue: (booking.invoiceData && booking.invoiceData.paymentDue) || '',
        reminderCount: reminderCount,
        isOverdue: true,
        daysOverdue: daysOverdue,
        bookingId: bookingId,
        automatic: true,
        sentAt: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        sentAtMs: Date.now()
    });
}

const DRY_RUN = process.argv.includes('--preview');

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: ' + (DRY_RUN ? 'VORSCHAU (kein Versand)' : 'Automatischer Versand') + ' - Zahlungserinnerungen');
    console.log('='.repeat(60));

    const snapshot = await db.collection('buchungen').where('invoiceSent', '==', true).get();
    console.log(`${snapshot.size} Buchung(en) mit versendeter Rechnung gefunden.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const booking = doc.data();
        const bookingId = doc.id;

        if (booking.invoicePaid) { skipped++; continue; }

        // Erste Erinnerung: fest 10 Tage nach Rechnungsdatum (invoiceDate),
        // unabhängig vom Zahlungsziel - das ist der explizite Wunsch des
        // Inhabers, nicht das Zahlungsziel als Auslöser zu verwenden.
        const invoiceDateStr = booking.invoiceData && booking.invoiceData.invoiceDate;
        const invoiceDate = parseGermanDate(invoiceDateStr);
        if (!invoiceDate) {
            console.log(`  ⏭ ${bookingId}: kein/ungültiges Rechnungsdatum, übersprungen.`);
            skipped++;
            continue;
        }

        const daysSinceInvoice = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
        if (daysSinceInvoice < REMINDER_INTERVAL_DAYS) { skipped++; continue; } // noch nicht 10 Tage her

        // Für die Anzeige "X Tage überfällig" in der Mail weiterhin am
        // Zahlungsziel messen, falls vorhanden - sonst am Rechnungsdatum.
        const paymentDueStr = booking.invoiceData && booking.invoiceData.paymentDue;
        const dueDate = parseGermanDate(paymentDueStr) || invoiceDate;
        const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));

        if (booking.paymentReminderSent && booking.paymentReminderDate) {
            const lastReminder = new Date(booking.paymentReminderDate);
            const daysSinceLastReminder = Math.floor((today - lastReminder) / (1000 * 60 * 60 * 24));
            if (daysSinceLastReminder < REMINDER_INTERVAL_DAYS) {
                console.log(`  ⏭ ${bookingId} (${booking.name || '-'}): letzte Erinnerung vor ${daysSinceLastReminder} Tag(en), noch nicht wieder fällig.`);
                skipped++;
                continue;
            }
        }

        if (!booking.email) {
            console.log(`  ⚠️ ${bookingId} (${booking.name || '-'}): ${daysOverdue} Tage überfällig, aber keine E-Mail-Adresse hinterlegt - übersprungen.`);
            skipped++;
            continue;
        }

        const reminderCount = (booking.paymentReminderCount || 0) + 1;

        if (DRY_RUN) {
            console.log(`  📧 WÜRDE senden an: ${booking.email} (${booking.name || booking.company || '-'}), Erinnerung #${reminderCount}, ${daysOverdue} Tage überfällig, Betrag ${booking.invoiceAmount || '?'}`);
            sent++;
            continue;
        }

        const { subject, text } = buildReminderEmail(booking, daysOverdue);

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
                paymentReminderSent: true,
                paymentReminderDate: nowIso,
                paymentReminderCount: reminderCount,
                aktualisiertAm: nowDe,
                lastModified: nowIso,
                lastModifiedMs: Date.now()
            });

            await archiveReminder(booking, bookingId, daysOverdue, reminderCount);

            console.log(`  ✓ Zahlungserinnerung #${reminderCount} an ${booking.email} gesendet (${booking.name || '-'}, ${daysOverdue} Tage überfällig).`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Fehler beim Senden an ${booking.email} (${bookingId}):`, err.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${sent} Erinnerung(en) ${DRY_RUN ? 'würden versendet werden' : 'versendet'}, ${skipped} Buchung(en) übersprungen.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim automatischen Zahlungserinnerungs-Versand:', err);
    process.exit(1);
});
