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
 * Jede sonstige externe E-Mail (kein "Contact Us:"-Template, kein Absender
 * einer bestehenden Buchung, kein offensichtlich automatisierter Absender
 * wie no-reply/Mailer-Daemon) wird ebenfalls als neue Buchung angelegt und
 * zur manuellen Prüfung markiert - damit keine Anfrage verloren geht, nur
 * weil sie nicht exakt über das Kontaktformular kam.
 *
 * Schreibt über das Firebase Admin SDK (Service-Account) in die Sammlung
 * "buchungen" (nicht "bookings"!) - genau die, die buchungen-uebersicht.html
 * tatsächlich anzeigt. Ein Admin-Zugang ist nötig, seit die Firestore-Regeln
 * auf "nur eingeloggte, erlaubte E-Mail-Adressen" beschränkt sind - der
 * öffentliche API-Key allein reicht seitdem nicht mehr aus.
 *
 * Verfolgt die höchste bereits verarbeitete IMAP-UID in state.json, statt
 * sich auf den "ungelesen"-Status zu verlassen (der kann durch anderes
 * Öffnen des Postfachs verändert werden, z.B. auf dem Handy).
 *
 * Durchsucht "[Gmail]/All Mail" statt nur "INBOX": eine alte Gmail-
 * Filterregel (vermutlich aus der früheren n8n-Automatisierung) markiert
 * "Contact Us:"-Mails als gesendet/markiert und überspringt dabei den
 * Posteingang, wodurch sie im reinen INBOX-Scan nie ankamen (Test am
 * 01.08.2026 hat das aufgedeckt). "All Mail" enthält alles außer Spam/
 * Papierkorb und ist damit unabhängig von solchen Filterregeln.
 *
 * Benötigt zwei lokale, NICHT eingecheckte Dateien in diesem Ordner:
 *   - config.json                    { "gmailAppPassword": "..." }
 *   - firebase-service-account.json  (siehe README.md, Abschnitt "Einrichtung")
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');
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

admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
});
const db = admin.firestore();

const EMAIL = 'eisfavorit@gmail.com';
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

async function addBookingToFirestore(booking) {
    const ref = await db.collection('buchungen').add(booking);
    return ref.id;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Offensichtlich automatisierte/nicht-menschliche Absender (Zustellfehler,
// Newsletter-Bestätigungen, Kalender-Benachrichtigungen usw.) - das sind keine
// echten Kunden-Anfragen und sollen keine Buchungskarte erzeugen.
const AUTOMATED_SENDER_RE = /no-?reply|mailer-daemon|postmaster|notifications?@|calendar-notification|@google\.com$|@facebookmail\.com$|@linkedin\.com$/i;

// Legt für eine sonst nicht erkannte, aber "echt wirkende" externe E-Mail
// trotzdem eine neue Buchung an (Status "Neu", zur manuellen Prüfung markiert),
// statt sie zu verwerfen - damit keine Anfrage verloren geht, die nicht exakt
// ins "Contact Us:"-Template passt (z.B. eine direkt an eisfavorit@gmail.com
// geschriebene E-Mail statt über das Kontaktformular).
function buildFallbackBooking(parsed, fromAddress, subject, receivedDate) {
    const fromName = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].name || '').trim();
    const text = (parsed.text || '').trim().slice(0, 2000);
    const today = new Date();
    const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
        status: 'Neu',
        name: fromName || fromAddress,
        email: fromAddress,
        phone: '',
        company: '',
        eventType: '',
        date: '',
        time: '',
        guests: '',
        kugeln: '',
        kugelPerGuest: '2',
        location: '',
        street: '',
        plz: '',
        city: '',
        distance: '',
        wunschsorten: '',
        notizen: text,
        eigeneNotizen: `⚠️ Automatisch importiert, kein bekanntes Formular-Template - bitte E-Mail prüfen. Betreff: "${subject}" (${receivedDate})`,
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

// Spiegelt eine Buchung mit gültiger E-Mail als "Bestandskunde"-Lead in
// "marketingLeads" (siehe werbung.html) - damit landen auch automatisch
// importierte Anfragen in der zentralen Adress-/Kampagnenliste, ohne
// manuellen Abgleich. Deterministische Doc-ID (bestandskunde-<bookingId>),
// damit spätere Aufrufe denselben Lead aktualisieren statt ihn zu duplizieren.
async function syncBookingToMarketingLeads(bookingId, booking) {
    const email = (booking.email || '').trim();
    if (!EMAIL_RE.test(email)) return;

    const address = [booking.street, [booking.plz, booking.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const leadRef = db.collection('marketingLeads').doc('bestandskunde-' + bookingId);
    try {
        const existing = await leadRef.get();
        const data = {
            name: booking.company || booking.name || '(kein Name)',
            category: 'bestandskunde',
            contactPerson: booking.company ? (booking.name || '') : '',
            address: address || '',
            phone: booking.phone || '',
            email: email,
            sourceBookingId: bookingId,
            sourceType: 'buchungen',
            lastModifiedMs: Date.now()
        };
        if (!existing.exists) {
            data.status = 'neu';
            data.createdAtMs = Date.now();
        }
        await leadRef.set(data, { merge: true });
    } catch (err) {
        console.error('  ⚠️ Konnte Bestandskunde-Lead nicht anlegen/aktualisieren:', err.message);
    }
}

// Prüft, ob am selben Tag bereits eine Buchung mit Status "Gebucht" existiert
// (gleiches Kriterium wie der manuelle Doppelbuchungs-Check in
// buchungen-uebersicht.html). Automatisch importierte Anfragen können nicht
// interaktiv bestätigt werden, deshalb wird der Konflikt stattdessen als
// Flag auf der Buchung gespeichert, damit er in der Buchungsübersicht
// (roter Warn-Badge) sofort auffällt.
async function checkDateConflict(dateStr) {
    if (!dateStr) return [];
    const snapshot = await db.collection('buchungen')
        .where('status', '==', 'Gebucht')
        .where('date', '==', dateStr)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

// Sucht Buchungen, deren Feld "email" zum Absender passt (case-insensitiv,
// da Kunden ihre Adresse mal groß, mal klein schreiben). Gibt die zuletzt
// bearbeitete passende Buchung zurück, oder null.
async function findBookingByEmail(fromAddress) {
    const candidates = [fromAddress, fromAddress.toLowerCase()];
    let matches = [];

    for (const candidate of candidates) {
        const snapshot = await db.collection('buchungen').where('email', '==', candidate).get();
        snapshot.forEach(doc => matches.push(doc));
        if (matches.length > 0) break;
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => (b.data().lastModifiedMs || 0) - (a.data().lastModifiedMs || 0));

    return matches[0];
}

// Hängt eine empfangene Kunden-Nachricht an das emailHistory-Array der
// gefundenen Buchung an.
async function appendReceivedMessageToBooking(doc, message, receivedAtIso) {
    const now = new Date();
    const updatedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

    await doc.ref.update({
        emailHistory: admin.firestore.FieldValue.arrayUnion({
            message: message,
            direction: 'received',
            timestamp: receivedAtIso
        }),
        aktualisiertAm: updatedDate,
        lastModified: now.toISOString(),
        lastModifiedMs: now.getTime()
    });

    return doc.id;
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
    // Ohne diesen Handler wirft ImapFlow bei einem Verbindungsabbruch (z.B.
    // ECONNRESET nach getaner Arbeit, bevor logout() sauber durchläuft) ein
    // unhandled 'error'-Event, das den ganzen Node-Prozess crasht.
    client.on('error', err => console.error('⚠️ IMAP-Verbindungsfehler (ignoriert):', err.message));

    await client.connect();
    console.log('✅ Mit Gmail verbunden.');

    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    let imported = 0;
    let replied = 0;
    let highestUid = state.lastUid;

    try {
        const allUids = await client.search({ all: true }, { uid: true });
        const newUids = (allUids || []).filter(uid => uid > state.lastUid);

        if (newUids.length === 0) {
            console.log('Keine neuen E-Mails seit dem letzten Lauf.');
        }
        if (newUids.length > 0) console.log(`${newUids.length} neue E-Mail(s) seit dem letzten Lauf gefunden.`);

        for (const uid of newUids) {
            try {
                const msg = await client.fetchOne(uid, { source: true }, { uid: true });

                const parsed = await simpleParser(msg.source);
                const subject = parsed.subject || '';

                if (subject.includes(CONTACT_SUBJECT)) {
                    const text = parsed.text || '';
                    const receivedDate = (parsed.date || new Date()).toLocaleString('de-DE');

                    const booking = parseContactUsEmail(text, receivedDate);

                    if (!booking.name && !booking.email) {
                        // Anderes/unbekanntes Template - trotzdem als Buchung anlegen
                        // (mit Rohtext + Warnhinweis), statt die Anfrage stillschweigend
                        // zu verwerfen. Landet so in "Neue Anfragen" zur manuellen Prüfung,
                        // statt für immer zu verschwinden.
                        booking.name = '(unbekannt - manuell prüfen)';
                        booking.notizen = text.slice(0, 2000);
                        booking.eigeneNotizen = `⚠️ Automatischer Import konnte diese Anfrage nicht auslesen (unbekanntes Template) vom ${receivedDate}. Bitte E-Mail manuell prüfen.`;
                        console.log(`  ⚠️ UID ${uid}: keine Daten erkannt (evtl. anderes Template) - als Buchung zur manuellen Prüfung angelegt`);
                    }

                    const conflicts = await checkDateConflict(booking.date);
                    if (conflicts.length > 0) {
                        booking.dateConflict = true;
                        booking.dateConflictInfo = conflicts.map(c => `${c.name || '-'} (${c.time || 'keine Uhrzeit'})`).join(', ');
                        console.log(`  ⚠️ Terminkonflikt am ${booking.date}: bereits gebucht - ${booking.dateConflictInfo}`);
                    }

                    const docId = await addBookingToFirestore(booking);
                    imported++;
                    console.log(`  ✓ Neue Anfrage importiert: ${booking.name} - ${booking.date || '(kein Datum)'} [Doc-ID ${docId}]`);
                    await syncBookingToMarketingLeads(docId, booking);
                } else {
                    // Kein Contact-Us-Formular - erst prüfen, ob es die Antwort eines
                    // Kunden auf eine bestehende Buchung ist (nach Absender-E-Mail
                    // zuordnen). Wenn nicht, trotzdem als neue Anfrage anlegen, statt
                    // die E-Mail zu verwerfen - siehe buildFallbackBooking().
                    const fromAddress = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address || '').trim();

                    if (!fromAddress || fromAddress.toLowerCase() === EMAIL.toLowerCase()) {
                        console.log(`  ⏭ UID ${uid} übersprungen (kein Anfrage-Betreff, keine externe Kunden-Antwort): "${subject}"`);
                    } else if (AUTOMATED_SENDER_RE.test(fromAddress)) {
                        console.log(`  ⏭ UID ${uid} übersprungen (automatisierter Absender ${fromAddress}): "${subject}"`);
                    } else {
                        const booking = await findBookingByEmail(fromAddress);
                        if (booking) {
                            const replyText = (parsed.text || '').trim().slice(0, 2000);
                            if (!replyText) {
                                console.log(`  ⏭ UID ${uid} übersprungen (leere Nachricht)`);
                            } else {
                                const receivedIso = (parsed.date || new Date()).toISOString();
                                const docId = await appendReceivedMessageToBooking(booking, replyText, receivedIso);
                                replied++;
                                console.log(`  ✓ Antwort von ${fromAddress} im Chat der Buchung [Doc-ID ${docId}] gespeichert`);
                            }
                        } else if ((parsed.text || '').trim()) {
                            const receivedDate = (parsed.date || new Date()).toLocaleString('de-DE');
                            const fallback = buildFallbackBooking(parsed, fromAddress, subject, receivedDate);
                            const docId = await addBookingToFirestore(fallback);
                            imported++;
                            console.log(`  ✓ Anfrage (unbekanntes Template) importiert: ${fallback.name} [Doc-ID ${docId}] - Betreff: "${subject}"`);
                            await syncBookingToMarketingLeads(docId, fallback);
                        } else {
                            console.log(`  ⏭ UID ${uid} übersprungen (leere Nachricht, Absender ${fromAddress} zu keiner Buchung gefunden): "${subject}"`);
                        }
                    }
                }

                // Erst nach erfolgreicher Verarbeitung als "erledigt" markieren - so wird
                // eine E-Mail, bei der unten ein Fehler auftritt, beim nächsten Lauf erneut
                // versucht statt endgültig übersprungen zu werden.
                if (uid > highestUid) highestUid = uid;
            } catch (err) {
                // Eine einzelne fehlerhafte E-Mail darf weder den ganzen Lauf abbrechen
                // noch dazu führen, dass bereits erfolgreich importierte Anfragen aus
                // diesem Lauf erneut dupliziert werden (siehe highestUid-Handling oben).
                console.error(`  ❌ UID ${uid} fehlgeschlagen, wird beim nächsten Lauf erneut versucht:`, err.message);
            }
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
