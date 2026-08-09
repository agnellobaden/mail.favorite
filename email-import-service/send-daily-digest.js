#!/usr/bin/env node
/**
 * EisFavorite: Tägliche Zusammenfassungs-Mail
 *
 * Fasst morgens den aktuellen Stand zusammen und schickt ihn per Mail an
 * den Inhaber, damit man nicht extra die App öffnen muss:
 *   - Offene neue Anfragen (Status "Neu"/"Anfrage")
 *   - Termine heute und morgen (Status "Gebucht")
 *   - Überfällige, unbezahlte Rechnungen
 *   - In den letzten 24h automatisch versendete Zahlungserinnerungen
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
const DIGEST_RECIPIENT = 'eisfavorit@gmail.com';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: config.gmailAppPassword }
});

function toGermanDateStr(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// "TT.MM.JJJJ" -> Date (lokale Zeit, Mitternacht)
function parseGermanDate(str) {
    if (!str) return null;
    const parts = str.trim().split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
}

async function getNeueAnfragen() {
    const snapshot = await db.collection('buchungen').where('status', 'in', ['Neu', 'Anfrage']).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getTermineHeuteMorgen(todayStr, tomorrowStr) {
    const snapshot = await db.collection('buchungen')
        .where('status', '==', 'Gebucht')
        .where('date', 'in', [todayStr, tomorrowStr])
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getUeberfaelligeRechnungen(today) {
    const snapshot = await db.collection('buchungen').where('invoiceSent', '==', true).get();
    const result = [];
    snapshot.forEach(doc => {
        const b = doc.data();
        if (b.invoicePaid) return;
        const dueDate = parseGermanDate(b.invoiceData && b.invoiceData.paymentDue);
        if (!dueDate) return;
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 0) {
            result.push({ id: doc.id, ...b, daysOverdue });
        }
    });
    result.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return result;
}

async function getAutomatischeErinnerungenLetzte24h() {
    // Nur Gleichheitsfilter (kein zusätzlicher Bereichsfilter), damit kein
    // Firestore-Composite-Index angelegt werden muss - der Zeitfilter läuft
    // stattdessen client-seitig.
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    const snapshot = await db.collection('zahlungserinnerungen')
        .where('automatic', '==', true)
        .get();
    return snapshot.docs
        .map(doc => doc.data())
        .filter(r => (r.sentAtMs || 0) >= cutoffMs);
}

function buildDigestText({ neueAnfragen, termine, ueberfaellig, erinnerungen, todayStr }) {
    const lines = [];
    lines.push(`Guten Morgen! Hier der Überblick für ${todayStr}:`);
    lines.push('');

    lines.push(`📩 OFFENE NEUE ANFRAGEN (${neueAnfragen.length})`);
    if (neueAnfragen.length === 0) {
        lines.push('  Keine offenen Anfragen.');
    } else {
        neueAnfragen.forEach(b => {
            lines.push(`  - ${b.name || '-'} | ${b.date || 'kein Datum'} ${b.time || ''} | ${b.eventType || ''}`.trimEnd());
        });
    }
    lines.push('');

    lines.push(`📅 TERMINE HEUTE/MORGEN (${termine.length})`);
    if (termine.length === 0) {
        lines.push('  Keine Termine heute oder morgen.');
    } else {
        termine.forEach(b => {
            lines.push(`  - ${b.date || '-'} ${b.time || ''} | ${b.name || '-'} (${b.guests || '?'} Gäste)`.trimEnd());
        });
    }
    lines.push('');

    lines.push(`⚠️ ÜBERFÄLLIGE RECHNUNGEN (${ueberfaellig.length})`);
    if (ueberfaellig.length === 0) {
        lines.push('  Keine überfälligen Rechnungen.');
    } else {
        ueberfaellig.forEach(b => {
            const invoiceNumber = b.invoiceNumber || (b.invoiceData && b.invoiceData.invoiceNumber) || '-';
            lines.push(`  - Rechnung ${invoiceNumber} | ${b.name || '-'} | ${b.invoiceAmount || ''} | ${b.daysOverdue} Tag(e) überfällig`);
        });
    }
    lines.push('');

    lines.push(`⏰ AUTOMATISCH VERSENDETE ZAHLUNGSERINNERUNGEN (letzte 24h): ${erinnerungen.length}`);
    erinnerungen.forEach(r => {
        lines.push(`  - Rechnung ${r.invoiceNumber || '-'} | ${r.customerName || '-'} | ${r.amount || ''}`);
    });
    lines.push('');

    lines.push('---');
    lines.push('Diese Übersicht wurde automatisch generiert.');

    return lines.join('\n');
}

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: Tägliche Zusammenfassungs-Mail');
    console.log('='.repeat(60));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toGermanDateStr(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toGermanDateStr(tomorrow);

    const [neueAnfragen, termine, ueberfaellig, erinnerungen] = await Promise.all([
        getNeueAnfragen(),
        getTermineHeuteMorgen(todayStr, tomorrowStr),
        getUeberfaelligeRechnungen(today),
        getAutomatischeErinnerungenLetzte24h()
    ]);

    console.log(`Neue Anfragen: ${neueAnfragen.length}, Termine heute/morgen: ${termine.length}, überfällige Rechnungen: ${ueberfaellig.length}, automatische Erinnerungen (24h): ${erinnerungen.length}`);

    const text = buildDigestText({ neueAnfragen, termine, ueberfaellig, erinnerungen, todayStr });

    await transporter.sendMail({
        from: `Eis Agnello <${EMAIL}>`,
        to: DIGEST_RECIPIENT,
        subject: `📋 EisFavorite Tagesübersicht - ${todayStr}`,
        text: text
    });

    console.log('✓ Zusammenfassungs-Mail versendet an', DIGEST_RECIPIENT);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim Versand der Tagesübersicht:', err);
    process.exit(1);
});
