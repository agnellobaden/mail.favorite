#!/usr/bin/env node
/**
 * EisFavorite: Automatischer E-Mail-Import (Node-Version)
 *
 * Holt ungelesene Anfrage-E-Mails (von eisfavorite.de via EmailJS) aus
 * eisfavorit@gmail.com per IMAP ab, extrahiert die Buchungsdaten per Regex
 * und schreibt sie direkt als neue Buchung (status "Neu") in Firestore.
 * Danach werden die E-Mails als gelesen markiert, damit sie beim nächsten
 * Lauf nicht erneut importiert werden.
 *
 * Schreibt über die öffentliche Firestore-REST-API in die Sammlung
 * "buchungen" (nicht "bookings"!) - genau die, die buchungen-uebersicht.html
 * tatsächlich anzeigt. Kein Firebase-Admin-Schlüssel nötig, da die
 * Firestore-Regeln aktuell offen sind.
 *
 * Benötigt eine lokale, NICHT eingecheckte Datei in diesem Ordner:
 *   - config.json   { "gmailAppPassword": "..." }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const CONFIG_PATH = path.join(__dirname, 'config.json');

if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ config.json fehlt. Bitte erst anlegen (siehe README.md in diesem Ordner).');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const EMAIL = 'eisfavorit@gmail.com';
const FIREBASE_PROJECT_ID = 'mailfavorite-e8f49';
const FIREBASE_API_KEY = 'AIzaSyDNtaUvAbjU2OHjLWNnNJyhkccoH9YlkYo';

// Schreibt ein Dokument über die öffentliche Firestore-REST-API (kein Admin-
// Schlüssel nötig - genau wie der Browser das auch tut).
function firestoreValue(v) {
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
    return { stringValue: String(v) };
}

function addBookingToFirestore(booking) {
    return new Promise((resolve, reject) => {
        const fields = {};
        Object.keys(booking).forEach(key => { fields[key] = firestoreValue(booking[key]); });
        const body = JSON.stringify({ fields });

        const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/buchungen?key=${FIREBASE_API_KEY}`;
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Firestore REST API Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Gleiche Regex-Muster wie im bisherigen Python-Script (email_importer.py),
// damit sich das Verhalten nicht ändert.
const PATTERNS = {
    name: [
        /Name:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)/i,
        /Von:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)/i,
        /Kontakt:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)/i,
    ],
    email: [
        /E-?Mail:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
        /Email:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    ],
    phone: [
        /Tel(?:efon)?:?\s*(\+?[0-9\s\-()\/]+)/i,
        /Mobil:?\s*(\+?[0-9\s\-()\/]+)/i,
        /(\+49\s*[0-9\s\-\/]+)/,
        /(0[0-9]{2,5}\s*[0-9\s\-\/]+)/,
    ],
    date: [
        /Datum:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
        /Termin:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
        /am\s+(\d{1,2}\.\d{1,2}\.\d{4})/i,
        /(\d{1,2}\.\d{1,2}\.\d{2,4})/,
    ],
    time: [
        /Uhrzeit:?\s*(\d{1,2}:\d{2})/i,
        /um\s+(\d{1,2}:\d{2})/i,
        /ab\s+(\d{1,2}:\d{2})/i,
        /(\d{1,2}:\d{2})\s*Uhr/i,
    ],
    guests: [
        /Gäste:?\s*(\d+)/i,
        /Personen:?\s*(\d+)/i,
        /Anzahl:?\s*(\d+)/i,
        /(\d+)\s+Gäste/i,
        /(\d+)\s+Personen/i,
    ],
    street: [
        /Straße:?\s*([A-ZÄÖÜa-zäöüß\s]+\d+[a-z]?)/i,
        /Adresse:?\s*([A-ZÄÖÜa-zäöüß\s]+\d+[a-z]?)/i,
    ],
    plz: [
        /PLZ:?\s*(\d{5})/i,
        /(\d{5})\s+[A-ZÄÖÜa-zäöüß]/,
    ],
    city: [
        /Stadt:?\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+)/i,
        /Ort:?\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+)/i,
        /\d{5}\s+([A-ZÄÖÜa-zäöüß][a-zäöüß]+)/,
    ],
    company: [
        /Firma:?\s*([A-ZÄÖÜa-zäöüß0-9\s&.\-]+)/i,
        /Unternehmen:?\s*([A-ZÄÖÜa-zäöüß0-9\s&.\-]+)/i,
    ],
    sorten: [
        /Sorten?:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)/i,
        /Geschmack:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)/i,
        /Wunsch:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)/i,
    ],
};

function extract(text, field) {
    const patterns = PATTERNS[field];
    if (!patterns) return '';
    for (const re of patterns) {
        const m = text.match(re);
        if (m) {
            let result = m[1].trim();
            if (field === 'phone') result = result.replace(/\s+/g, ' ');
            if (field === 'date') {
                const parts = result.split('.');
                if (parts.length === 3 && parts[2].length === 2) {
                    result = `${parts[0]}.${parts[1]}.20${parts[2]}`;
                }
            }
            return result;
        }
    }
    return '';
}

function parseEmailToBooking(subject, fromAddress, text, receivedDate) {
    const fullText = `${subject}\n${text}`;
    const today = new Date();
    const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
        status: 'Neu',
        name: extract(fullText, 'name') || extract(fromAddress, 'name') || '',
        email: extract(fullText, 'email') || fromAddress || '',
        phone: extract(fullText, 'phone') || '',
        company: extract(fullText, 'company') || '',
        date: extract(fullText, 'date') || '',
        time: extract(fullText, 'time') || '',
        timeEnd: '',
        guests: extract(fullText, 'guests') || '',
        kugeln: '',
        kugelPerGuest: '2',
        location: '',
        street: extract(fullText, 'street') || '',
        plz: extract(fullText, 'plz') || '',
        city: extract(fullText, 'city') || '',
        distance: '',
        wunschsorten: extract(fullText, 'sorten') || '',
        notizen: (text || '').slice(0, 500),
        eigeneNotizen: `📧 Automatisch importiert aus E-Mail vom ${receivedDate}`,
        angebotUrl: '',
        angebotVorlage: '',
        rechnungUrl: '',
        erstelltAm: todayStr,
        aktualisiertAm: todayStr,
        lastModified: new Date().toISOString(),
        lastModifiedMs: Date.now(),
        isNewFromEmail: true,
        _emailSubject: subject,
        _emailFrom: fromAddress,
        _emailDate: receivedDate,
    };
}

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite E-Mail-Import (automatisch, direkt in Firestore)');
    console.log('='.repeat(60));

    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: EMAIL, pass: config.gmailAppPassword },
        logger: false,
    });

    await client.connect();
    console.log('✅ Mit Gmail verbunden.');

    const lock = await client.getMailboxLock('INBOX');
    let imported = 0;
    try {
        const messages = await client.search({ seen: false });
        if (!messages || messages.length === 0) {
            console.log('Keine neuen (ungelesenen) E-Mails gefunden.');
            return;
        }
        console.log(`${messages.length} ungelesene E-Mail(s) gefunden.`);

        for (const seq of messages) {
            const msg = await client.fetchOne(seq, { source: true });
            const parsed = await simpleParser(msg.source);
            const subject = parsed.subject || '';
            const fromAddress = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address) || '';
            const text = parsed.text || '';
            const receivedDate = (parsed.date || new Date()).toLocaleString('de-DE');

            const booking = parseEmailToBooking(subject, fromAddress, text, receivedDate);

            const ref = await addBookingToFirestore(booking);
            imported++;
            const docId = (ref.name || '').split('/').pop();
            console.log(`  ✓ Neue Anfrage importiert: ${booking.name || '(kein Name erkannt)'} - ${booking.date || '(kein Datum erkannt)'} [Doc-ID ${docId}]`);

            // Als gelesen markieren, damit sie beim nächsten Lauf nicht erneut importiert wird.
            await client.messageFlagsAdd(seq, ['\\Seen']);
        }
    } finally {
        lock.release();
    }

    await client.logout();
    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${imported} neue Anfrage(n) direkt in die App übernommen.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim E-Mail-Import:', err);
    process.exit(1);
});
