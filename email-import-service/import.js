#!/usr/bin/env node
/**
 * EisFavorite: Automatischer E-Mail-Import (Node-Version)
 *
 * Holt neue "Contact Us:"-Anfrage-E-Mails (von eisfavorite.de via EmailJS,
 * Template "template_6aq2k69") aus eisfavorit@gmail.com per IMAP ab,
 * extrahiert die Buchungsdaten und schreibt sie direkt als neue Buchung
 * (status "Neu") in Firestore.
 *
 * Erkennt außerdem Antwort-E-Mails von Kunden (kein "Contact Us:"-Betreff):
 * wird der Absender einer bestehenden Buchung zugeordnet (Feld "email"),
 * landet die Nachricht automatisch als "empfangen" im emailHistory-Chat
 * dieser Buchung - genau wie in buchungen-uebersicht.html angezeigt.
 *
 * Schreibt über die öffentliche Firestore-REST-API in die Sammlung
 * "buchungen" (nicht "bookings"!) - genau die, die buchungen-uebersicht.html
 * tatsächlich anzeigt. Kein Firebase-Admin-Schlüssel nötig, da die
 * Firestore-Regeln aktuell offen sind.
 *
 * Verfolgt die höchste bereits verarbeitete IMAP-UID in state.json, statt
 * sich auf den "ungelesen"-Status zu verlassen (der kann durch anderes
 * Öffnen des Postfachs verändert werden, z.B. auf dem Handy).
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
const STATE_PATH = path.join(__dirname, 'state.json');

if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ config.json fehlt. Bitte erst anlegen (siehe README.md in diesem Ordner).');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const EMAIL = 'eisfavorit@gmail.com';
const FIREBASE_PROJECT_ID = 'mailfavorite-e8f49';
const FIREBASE_API_KEY = 'AIzaSyDNtaUvAbjU2OHjLWNnNJyhkccoH9YlkYo';
const CONTACT_SUBJECT = 'Contact Us:';

function loadState() {
    if (!fs.existsSync(STATE_PATH)) return { lastUid: 0 };
    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (e) {
        return { lastUid: 0 };
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Schreibt ein Dokument über die öffentliche Firestore-REST-API (kein Admin-
// Schlüssel nötig - genau wie der Browser das auch tut).
function firestoreValue(v) {
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
    return { stringValue: String(v) };
}

// Wandelt einen beliebigen JS-Wert (auch verschachtelte Arrays/Objekte) in
// das Firestore-REST-Wertformat um - wird für das Anhängen an emailHistory
// gebraucht (das ist ein Array von Objekten, nicht nur flache Felder).
function jsToFirestoreValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(jsToFirestoreValue) } };
    if (typeof v === 'object') {
        const fields = {};
        Object.keys(v).forEach(key => { fields[key] = jsToFirestoreValue(v[key]); });
        return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
}

// Kehrt jsToFirestoreValue um - liest ein Firestore-REST-Wertfeld zurück in
// einen normalen JS-Wert.
function firestoreValueToJs(v) {
    if (!v) return null;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('doubleValue' in v) return v.doubleValue;
    if ('stringValue' in v) return v.stringValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(firestoreValueToJs);
    if ('mapValue' in v) {
        const obj = {};
        const fields = v.mapValue.fields || {};
        Object.keys(fields).forEach(key => { obj[key] = firestoreValueToJs(fields[key]); });
        return obj;
    }
    return null;
}

function firestoreRestRequest(method, url, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const req = https.request(url, {
            method,
            headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data ? JSON.parse(data) : null);
                } else {
                    reject(new Error(`Firestore REST API Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Sucht Buchungen, deren Feld "email" zum Absender passt (case-insensitiv,
// da Kunden ihre Adresse mal groß, mal klein schreiben). Gibt die zuletzt
// bearbeitete passende Buchung zurück, oder null.
async function findBookingByEmail(fromAddress) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const candidates = [fromAddress, fromAddress.toLowerCase()];
    let matches = [];

    for (const candidate of candidates) {
        const body = {
            structuredQuery: {
                from: [{ collectionId: 'buchungen' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'email' },
                        op: 'EQUAL',
                        value: { stringValue: candidate }
                    }
                },
                limit: 10
            }
        };
        const results = await firestoreRestRequest('POST', url, body);
        (results || []).forEach(r => { if (r.document) matches.push(r.document); });
        if (matches.length > 0) break;
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => {
        const aFields = a.fields || {};
        const bFields = b.fields || {};
        const aMs = aFields.lastModifiedMs ? firestoreValueToJs(aFields.lastModifiedMs) : 0;
        const bMs = bFields.lastModifiedMs ? firestoreValueToJs(bFields.lastModifiedMs) : 0;
        return bMs - aMs;
    });

    return matches[0];
}

// Hängt eine empfangene Kunden-Nachricht an das emailHistory-Array der
// gefundenen Buchung an (Read-Modify-Write, da die REST-API kein arrayUnion
// über einfache PATCH-Requests unterstützt).
async function appendReceivedMessageToBooking(document, message, receivedAtIso) {
    const docId = document.name.split('/').pop();
    const fields = document.fields || {};
    const existingHistory = fields.emailHistory ? firestoreValueToJs(fields.emailHistory) : [];

    existingHistory.push({
        message: message,
        direction: 'received',
        timestamp: receivedAtIso
    });

    const now = new Date();
    const updatedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/buchungen/${docId}` +
        `?updateMask.fieldPaths=emailHistory&updateMask.fieldPaths=aktualisiertAm&updateMask.fieldPaths=lastModified&updateMask.fieldPaths=lastModifiedMs` +
        `&key=${FIREBASE_API_KEY}`;

    const body = {
        fields: {
            emailHistory: jsToFirestoreValue(existingHistory),
            aktualisiertAm: { stringValue: updatedDate },
            lastModified: { stringValue: now.toISOString() },
            lastModifiedMs: { integerValue: now.getTime() }
        }
    };

    await firestoreRestRequest('PATCH', url, body);
    return docId;
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

const GERMAN_MONTHS = {
    januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06',
    juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12'
};

// "Freitag, 31. Juli 2026" -> "31.07.2026"
function parseGermanLongDate(str) {
    if (!str) return '';
    const m = str.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/);
    if (!m) return str.trim();
    const day = m[1].padStart(2, '0');
    const month = GERMAN_MONTHS[m[2].toLowerCase()];
    const year = m[3];
    if (!month) return str.trim();
    return `${day}.${month}.${year}`;
}

function field(text, label) {
    const re = new RegExp(label + ':\\s*(.+)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
}

// Parst das feste "Contact Us:"-Template von eisfavorite.de/EmailJS.
function parseContactUsEmail(text, receivedDate) {
    const name = field(text, 'Name');
    const email = field(text, 'E-Mail');
    const phone = field(text, 'Telefon');
    const eventType = field(text, 'Veranstaltung');
    const dateRaw = field(text, 'Datum');
    const time = field(text, 'Uhrzeit');
    const guests = field(text, 'Gäste');
    const streetLine = field(text, 'Straße & Hausnummer');
    const plzOrtLine = field(text, 'PLZ & Ort');
    const messageMatch = text.match(/Nachricht:\s*([\s\S]*?)(?:\n\n---|\nEmail sent via|$)/i);
    const message = messageMatch ? messageMatch[1].trim() : '';

    const plzMatch = plzOrtLine.match(/(\d{5})\s*(.*)/);
    const plz = plzMatch ? plzMatch[1] : '';
    const city = plzMatch ? plzMatch[2].trim() : plzOrtLine;

    const today = new Date();
    const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
        status: 'Neu',
        name: name,
        email: email,
        phone: phone,
        company: '',
        eventType: eventType,
        date: parseGermanLongDate(dateRaw),
        time: time,
        timeEnd: '',
        guests: guests,
        kugeln: '',
        kugelPerGuest: '2',
        location: '',
        street: streetLine,
        plz: plz,
        city: city,
        distance: '',
        wunschsorten: '',
        notizen: message,
        eigeneNotizen: `📧 Automatisch importiert (Contact-Us-Mail vom ${receivedDate})`,
        angebotUrl: '',
        angebotVorlage: '',
        rechnungUrl: '',
        erstelltAm: todayStr,
        aktualisiertAm: todayStr,
        lastModified: new Date().toISOString(),
        lastModifiedMs: Date.now(),
        isNewFromEmail: true,
        source: 'email',
    };
}

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite E-Mail-Import (automatisch, direkt in Firestore)');
    console.log('='.repeat(60));

    const state = loadState();
    console.log(`Zuletzt verarbeitete UID: ${state.lastUid}`);

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
    let replied = 0;
    let highestUid = state.lastUid;

    try {
        const allUids = await client.search({ all: true }, { uid: true });
        const newUids = (allUids || []).filter(uid => uid > state.lastUid);

        if (newUids.length === 0) {
            console.log('Keine neuen E-Mails seit dem letzten Lauf.');
            return;
        }
        console.log(`${newUids.length} neue E-Mail(s) seit dem letzten Lauf gefunden.`);

        for (const uid of newUids) {
            const msg = await client.fetchOne(uid, { source: true }, { uid: true });
            if (uid > highestUid) highestUid = uid;

            const parsed = await simpleParser(msg.source);
            const subject = parsed.subject || '';

            if (subject.includes(CONTACT_SUBJECT)) {
                const text = parsed.text || '';
                const receivedDate = (parsed.date || new Date()).toLocaleString('de-DE');

                const booking = parseContactUsEmail(text, receivedDate);

                if (!booking.name && !booking.email) {
                    console.log(`  ⚠️ UID ${uid} übersprungen (keine Daten erkannt, evtl. anderes Template)`);
                    continue;
                }

                const ref = await addBookingToFirestore(booking);
                imported++;
                const docId = (ref.name || '').split('/').pop();
                console.log(`  ✓ Neue Anfrage importiert: ${booking.name} - ${booking.date || '(kein Datum)'} [Doc-ID ${docId}]`);
                continue;
            }

            // Kein Anfrage-Formular - prüfen, ob es die Antwort eines Kunden
            // auf eine bestehende Buchung ist (nach Absender-E-Mail zuordnen).
            const fromAddress = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address || '').trim();

            if (!fromAddress || fromAddress.toLowerCase() === EMAIL.toLowerCase()) {
                console.log(`  ⏭ UID ${uid} übersprungen (kein Anfrage-Betreff, keine externe Kunden-Antwort): "${subject}"`);
                continue;
            }

            const booking = await findBookingByEmail(fromAddress);
            if (!booking) {
                console.log(`  ⏭ UID ${uid} übersprungen (Absender ${fromAddress} zu keiner Buchung gefunden): "${subject}"`);
                continue;
            }

            const replyText = (parsed.text || '').trim().slice(0, 2000);
            if (!replyText) {
                console.log(`  ⏭ UID ${uid} übersprungen (leere Nachricht)`);
                continue;
            }

            const receivedIso = (parsed.date || new Date()).toISOString();
            const docId = await appendReceivedMessageToBooking(booking, replyText, receivedIso);
            replied++;
            console.log(`  ✓ Antwort von ${fromAddress} im Chat der Buchung [Doc-ID ${docId}] gespeichert`);
        }
    } finally {
        lock.release();
    }

    await client.logout();
    saveState({ lastUid: highestUid });

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${imported} neue Anfrage(n) importiert, ${replied} Kunden-Antwort(en) im Chat gespeichert.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim E-Mail-Import:', err);
    process.exit(1);
});
