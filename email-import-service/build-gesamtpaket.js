// Baut das komplette "ein Knopfdruck"-Steuerberater-Paket fuer EisFavorite:
// DATEV-Buchungsstapel-CSV, lesbare CSV, LIESMICH.txt, alle Belege (aus den
// gescannten/fotografierten Dateien, die schon in Firestore mit den
// Buchungen verknuepft sind), alle Ausgangsrechnungen und alle
// Tagesberichte (PDFs aus exports/Kassenberichte/) - gezippt in EINE Datei.
// Wird von print-listener.js aufgerufen (Job-Typ "gesamtpaket"), kann aber
// auch direkt mit `node build-gesamtpaket.js 2026-07-01 2026-09-30` getestet
// werden.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const APP_DIR = path.join(__dirname, '..');
const KASSENBERICHTE_DIR = path.join(__dirname, 'exports', 'Kassenberichte');
const PAKET_DIR = path.join(__dirname, 'exports', 'Steuerberater-Pakete');

const EXPENSE_CATEGORIES_KONTO = {
    'Wareneinkauf': (mwstSatz) => mwstSatz === 7 ? '3300' : '3400',
    'Kfz-Kosten': () => '4530',
    'Miete/Nebenkosten': () => '4215',
    'Versicherungen': () => '4360',
    'Werbung/Marketing': () => '4600',
    'Büro/Verwaltung': () => '4930'
};
function datevExpenseKonto(kategorie, mwstSatz) {
    const fn = EXPENSE_CATEGORIES_KONTO[kategorie];
    return fn ? fn(mwstSatz) : '4900';
}
function datevExpenseBu(konto, mwstSatz) {
    if (konto === '3300' || konto === '3400' || konto === '4360') return '';
    if (mwstSatz === 7) return '8';
    if (mwstSatz == null || mwstSatz > 0) return '9';
    return '';
}

function formatEuro(n) {
    return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function parseAmountToNumber(str) {
    if (str == null) return null;
    if (typeof str === 'number') return str;
    const cleaned = String(str).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}
function parseDeDateToIso(deDate) {
    const parts = String(deDate || '').trim().split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (!d || !m || !y) return null;
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
function isoToDe(dateIso) {
    const [y, m, d] = dateIso.split('-');
    return `${d}.${m}.${y}`;
}
function isSnackOase(kunde) {
    return !!(kunde && /snack-?oase/i.test(kunde));
}
function calculateTravelCost(distance) {
    const km = parseFloat(distance) || 0;
    if (km < 6) return 0;
    if (km < 10) return 45;
    const additionalKm = km - 10;
    const additionalCost = Math.floor(additionalKm / 10) * 10;
    return 55 + additionalCost;
}
function bookingToEntry(id, b) {
    if (!b.date) return null;
    if (b.status === 'Storniert') return null;
    const dateParts = b.date.split('.');
    if (dateParts.length !== 3) return null;
    const dateIso = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
    let amount = null;
    if (b.invoiceAmount) amount = parseAmountToNumber(b.invoiceAmount);
    else if (b.invoiceData && Array.isArray(b.invoiceData.items) && b.invoiceData.items.length > 0) {
        amount = b.invoiceData.items.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(String(item.bruttoPrice).replace(',', '.')) || 0;
            return sum + qty * price;
        }, 0);
    } else if (b.tallyTotal != null) {
        amount = (parseFloat(b.tallyTotal) || 0) + calculateTravelCost(b.distance) * 1.07;
    }
    if (amount == null) return null;
    const paymentMethod = b.invoiceData && b.invoiceData.paymentMethod === 'bar' ? 'bar'
        : b.invoiceData && b.invoiceData.paymentMethod === 'ueberweisung' ? 'ueberweisung' : null;
    return { id: 'booking-' + id, dateIso, date: b.date, amount, note: 'Event: ' + (b.company || b.name || 'Unbekannt'), paymentMethod, fromBooking: true };
}

function dataUriToBuffer(dataUri) {
    const m = /^data:([^;,]+)[^,]*,(.*)$/s.exec(dataUri || '');
    if (!m) return null;
    return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}
function safeFilename(name) {
    return String(name || 'Datei').replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
}
function extForMime(mime) {
    if (mime === 'application/pdf') return '.pdf';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    return '';
}

async function buildGesamtpaket({ von, bis }) {
    if (!fs.existsSync(PAKET_DIR)) fs.mkdirSync(PAKET_DIR, { recursive: true });

    const [kontoauszugSnap, kassenbuchSnap, tageseinnahmenSnap, buchungenSnap, rechnungsarchivSnap] = await Promise.all([
        db.collection('kontoauszug').get(),
        db.collection('kassenbuch').get(),
        db.collection('tageseinnahmen').get(),
        db.collection('buchungen').get(),
        db.collection('rechnungsarchiv').get()
    ]);

    const allKontoauszug = [];
    kontoauszugSnap.forEach(doc => allKontoauszug.push({ id: doc.id, ...doc.data() }));
    const allKassenbuch = [];
    kassenbuchSnap.forEach(doc => allKassenbuch.push({ id: doc.id, ...doc.data() }));
    const allTageseinnahmen = [];
    tageseinnahmenSnap.forEach(doc => allTageseinnahmen.push({ id: doc.id, ...doc.data() }));
    const allBookingEntries = [];
    buchungenSnap.forEach(doc => { const e = bookingToEntry(doc.id, doc.data()); if (e) allBookingEntries.push(e); });
    const invoicesByBookingId = {};
    const allRechnungsarchiv = [];
    rechnungsarchivSnap.forEach(doc => {
        const inv = { id: doc.id, ...doc.data() };
        if (inv.bookingId) invoicesByBookingId[inv.bookingId] = inv;
        allRechnungsarchiv.push(inv);
    });

    const inRange = (dateIso) => dateIso && dateIso >= von && dateIso <= bis;

    const revenue = allTageseinnahmen.concat(allBookingEntries).filter(e => inRange(e.dateIso));
    const cashExpenses = allKassenbuch.filter(e => e.type === 'ausgabe' && inRange(e.dateIso));
    const bankExpenses = allKontoauszug
        .filter(e => e.category === 'geschaeft' && inRange(e.dateIso) && !isSnackOase(e.kunde))
        .map(e => ({
            id: e.id, dateIso: e.dateIso, date: e.date, amount: e.betrag, belegNr: e.belegNr || '',
            scanFile: e.scanFile || '', scanDataUri: e.scanDataUri || '', kunde: e.kunde || '',
            kategorie: e.kategorie || 'Sonstiges', mwstSatz: e.mwstSatz != null ? e.mwstSatz : 19,
            vorsteuerExact: e.vorsteuerExact != null ? e.vorsteuerExact : null,
            note: ((e.note && e.note.trim()) || (e.empfaenger ? e.empfaenger + ' - ' : '') + (e.verwendungszweck || '')).replace(/\s+/g, ' ').trim()
        }));

    function calcVorsteuer(expenses) {
        return expenses.reduce((s, e) => {
            if (e.vorsteuerExact != null) return s + e.vorsteuerExact;
            const satz = e.mwstSatz != null ? e.mwstSatz : 19;
            if (satz <= 0) return s;
            return s + (parseFloat(e.amount) || 0) * satz / (100 + satz);
        }, 0);
    }
    function invoiceForRevenueEntry(e) {
        if (!e.fromBooking) return null;
        const bookingId = String(e.id || '').replace(/^booking-/, '');
        return invoicesByBookingId[bookingId] || null;
    }

    // ---- 1) DATEV-Buchungsstapel-CSV ----
    const csvEscape = v => `"${String(v).replace(/"/g, '""')}"`;
    const datevRows = [];
    revenue.forEach(e => {
        const inv = invoiceForRevenueEntry(e);
        datevRows.push({
            sortIso: e.dateIso,
            row: [
                (parseFloat(e.amount) || 0).toFixed(2).replace('.', ','), 'H', '8400',
                e.paymentMethod === 'ueberweisung' ? '1200' : '1000', '',
                isoToDe(e.dateIso), (inv && inv.invoiceNumber) || e.belegNr || '',
                String(e.note || 'Erlös').replace(/\s+/g, ' ').trim().slice(0, 60)
            ]
        });
    });
    cashExpenses.forEach(e => {
        const mwstSatz = e.mwstSatz != null ? e.mwstSatz : 19;
        const konto = datevExpenseKonto(e.kategorie || 'Sonstiges', mwstSatz);
        datevRows.push({
            sortIso: e.dateIso,
            row: [
                (parseFloat(e.amount) || 0).toFixed(2).replace('.', ','), 'S', konto, '1000',
                datevExpenseBu(konto, mwstSatz), isoToDe(e.dateIso), e.belegNr || '',
                ((e.kategorie || 'Sonstiges') + ' - ' + (e.note || '')).replace(/\s+/g, ' ').trim().slice(0, 60)
            ]
        });
    });
    bankExpenses.forEach(e => {
        const mwstSatz = e.mwstSatz != null ? e.mwstSatz : 19;
        const konto = datevExpenseKonto(e.kategorie || 'Sonstiges', mwstSatz);
        datevRows.push({
            sortIso: e.dateIso,
            row: [
                (parseFloat(e.amount) || 0).toFixed(2).replace('.', ','), 'S', konto, '1200',
                datevExpenseBu(konto, mwstSatz), isoToDe(e.dateIso), e.belegNr || '',
                ((e.kategorie || 'Sonstiges') + ' - ' + (e.note || '')).replace(/\s+/g, ' ').trim().slice(0, 60)
            ]
        });
    });
    datevRows.sort((a, b) => (a.sortIso || '').localeCompare(b.sortIso || ''));
    const datevLines = [['Umsatz (Brutto)', 'S/H', 'Konto', 'Gegenkonto', 'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Buchungstext']]
        .concat(datevRows.map(r => r.row));
    const datevCsv = '﻿' + datevLines.map(row => row.map(csvEscape).join(';')).join('\r\n');

    // ---- 2) Lesbare Übersicht als CSV ----
    const totalBrutto = revenue.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalUst = totalBrutto - (totalBrutto / 1.07);
    const vorsteuer = calcVorsteuer(cashExpenses.concat(bankExpenses));
    const uebersichtLines = [
        ['Steuerreport EisFavorite', `${von} bis ${bis}`], [],
        ['USt-Zusammenfassung'],
        ['Umsatzsteuer aus Einnahmen (€)', totalUst.toFixed(2).replace('.', ',')],
        ['Vorsteuer aus Ausgaben (€)', vorsteuer.toFixed(2).replace('.', ',')],
        ['USt-Zahllast an Finanzamt (€)', (totalUst - vorsteuer).toFixed(2).replace('.', ',')], [],
        ['Betriebseinnahmen'],
        ['Datum', 'Zahlungsart', 'Notiz', 'Betrag (€)', 'Rechnungsnummer']
    ];
    [...revenue].sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '')).forEach(e => {
        const inv = invoiceForRevenueEntry(e);
        uebersichtLines.push([e.date || e.dateIso || '', e.paymentMethod === 'bar' ? 'Kasse' : e.paymentMethod === 'ueberweisung' ? 'Überweisung' : '-', e.note || '', (parseFloat(e.amount) || 0).toFixed(2).replace('.', ','), (inv && inv.invoiceNumber) || '']);
    });
    uebersichtLines.push([], ['Betriebsausgaben (Kassenbuch, bar)'], ['Datum', 'Kategorie', 'Notiz', 'MwSt-Satz', 'Betrag (€)']);
    [...cashExpenses].sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '')).forEach(e => {
        uebersichtLines.push([e.date || e.dateIso || '', e.kategorie || 'Sonstiges', e.note || '', (e.mwstSatz != null ? e.mwstSatz : 19) + '%', (parseFloat(e.amount) || 0).toFixed(2).replace('.', ',')]);
    });
    uebersichtLines.push([], ['Betriebsausgaben (Kontoauszug, per Bank)'], ['Datum', 'Kategorie', 'MwSt-Satz', 'Beleg-Nr.', 'Notiz', 'Betrag (€)']);
    [...bankExpenses].sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || '')).forEach(e => {
        uebersichtLines.push([e.date || e.dateIso || '', e.kategorie || 'Sonstiges', (e.mwstSatz != null ? e.mwstSatz : 19) + '%', e.belegNr || '', e.note || '', (parseFloat(e.amount) || 0).toFixed(2).replace('.', ',')]);
    });
    const uebersichtCsv = '﻿' + uebersichtLines.map(row => row.map(csvEscape).join(';')).join('\r\n');

    // ---- 3) LIESMICH.txt ----
    const heute = new Date().toLocaleDateString('de-DE');
    const liesmich = `EisFavorite - Buchhaltungsunterlagen für den Steuerberater
====================================================================

Zeitraum: ${von} bis ${bis}
Erstellt am: ${heute}

Firma: Andrea Agnello, "Mobiler Eisverkauf Agnello" (EisFavorite)
Versteuerung: Ist-Versteuerung | Kontenrahmen: SKR03

Enthaltene Dateien/Ordner:
  1) Buchungsstapel_DATEV.csv - maschinenlesbarer Buchungsstapel
     (Umsatz Brutto; S/H; Konto; Gegenkonto; BU-Schlüssel; Belegdatum;
     Belegfeld 1; Buchungstext) - direkt importierbar.
  2) Uebersicht_lesbar.csv - dieselben Daten für Menschen lesbar.
  3) Belege/ - alle gescannten/fotografierten Belege zu den Ausgaben,
     Dateiname beginnt mit der Beleg-Nr.
  4) Rechnungen/ - alle Ausgangsrechnungen (Event-/Catering-Rechnungen)
     als PDF.
  5) Tagesberichte/ - Kassenberichte (Kassensturz) für jeden Tag mit
     Bareinnahmen im Zeitraum.

Kurzübersicht:
  Betriebseinnahmen (brutto):      ${formatEuro(totalBrutto)}
  Betriebsausgaben - Vorsteuer:    ${formatEuro(vorsteuer)}
  USt-Zahllast (Saldo):            ${formatEuro(totalUst - vorsteuer)}

Hinweis: Snack-Oase (zweites Gewerbe über dasselbe Konto) ist NICHT in
diesem Paket enthalten - das läuft als eigenes Mandat/eigene Unterlagen.

Bei Rückfragen: Andrea Agnello, agnello.baden@gmail.com
`;

    // ---- Ordner aufbauen ----
    const paketName = `Steuerberater-Paket_EisFavorite_${von}_bis_${bis}`;
    const paketFolder = path.join(PAKET_DIR, paketName);
    if (fs.existsSync(paketFolder)) fs.rmSync(paketFolder, { recursive: true, force: true });
    fs.mkdirSync(paketFolder, { recursive: true });
    fs.mkdirSync(path.join(paketFolder, 'Belege'));
    fs.mkdirSync(path.join(paketFolder, 'Rechnungen'));
    fs.mkdirSync(path.join(paketFolder, 'Tagesberichte'));

    fs.writeFileSync(path.join(paketFolder, 'Buchungsstapel_DATEV.csv'), datevCsv);
    fs.writeFileSync(path.join(paketFolder, 'Uebersicht_lesbar.csv'), uebersichtCsv);
    fs.writeFileSync(path.join(paketFolder, 'LIESMICH.txt'), liesmich);

    // Belege (aus kassenbuch + kontoauszug, scanDataUri)
    let belegeCount = 0;
    [...cashExpenses, ...bankExpenses].forEach(e => {
        if (!e.scanDataUri) return;
        const parsed = dataUriToBuffer(e.scanDataUri);
        if (!parsed) return;
        const ext = extForMime(parsed.mime) || path.extname(e.scanFile || '') || '.bin';
        const name = safeFilename(`${e.belegNr || e.dateIso}_${e.scanFile || 'Beleg'}`.replace(new RegExp(path.extname(e.scanFile || '') + '$'), '')) + ext;
        fs.writeFileSync(path.join(paketFolder, 'Belege', name), parsed.buffer);
        belegeCount++;
    });

    // Rechnungen (Ausgangsrechnungen zu Einnahmen im Zeitraum)
    let rechnungenCount = 0;
    const seenInvoiceIds = new Set();
    revenue.forEach(e => {
        const inv = invoiceForRevenueEntry(e);
        if (!inv || !inv.pdfDataUri || seenInvoiceIds.has(inv.id)) return;
        seenInvoiceIds.add(inv.id);
        const parsed = dataUriToBuffer(inv.pdfDataUri);
        if (!parsed) return;
        const name = safeFilename(inv.filename || `Rechnung_${inv.invoiceNumber || inv.id}.pdf`);
        fs.writeFileSync(path.join(paketFolder, 'Rechnungen', name.endsWith('.pdf') ? name : name + '.pdf'), parsed.buffer);
        rechnungenCount++;
    });

    // Tagesberichte (vorhandene PDFs aus exports/Kassenberichte im Zeitraum)
    let tagesberichteCount = 0;
    if (fs.existsSync(KASSENBERICHTE_DIR)) {
        fs.readdirSync(KASSENBERICHTE_DIR).forEach(file => {
            const m = file.match(/Kassenbericht_(\d{4}-\d{2}-\d{2})/);
            if (!m) return;
            if (m[1] < von || m[1] > bis) return;
            fs.copyFileSync(path.join(KASSENBERICHTE_DIR, file), path.join(paketFolder, 'Tagesberichte', file));
            tagesberichteCount++;
        });
    }

    // ---- Zippen (PowerShell Compress-Archive, keine neue Abhängigkeit) ----
    const zipPath = paketFolder + '.zip';
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    await new Promise((resolve, reject) => {
        execFile('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path "${paketFolder}\\*" -DestinationPath "${zipPath}" -Force`], (err) => {
            if (err) reject(err); else resolve();
        });
    });

    return {
        zipPath, paketFolder,
        stats: { einnahmen: revenue.length, barausgaben: cashExpenses.length, bankausgaben: bankExpenses.length, belege: belegeCount, rechnungen: rechnungenCount, tagesberichte: tagesberichteCount }
    };
}

module.exports = { buildGesamtpaket };

if (require.main === module) {
    const von = process.argv[2] || '2026-01-01';
    const bis = process.argv[3] || new Date().toISOString().slice(0, 10);
    buildGesamtpaket({ von, bis }).then(result => {
        console.log('✅ Fertig:', result.zipPath);
        console.log(result.stats);
        process.exit(0);
    }).catch(err => { console.error('FEHLER:', err); process.exit(1); });
}
