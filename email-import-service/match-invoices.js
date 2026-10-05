// Einmalig ausführbares Skript: gleicht die selbst gestellten Rechnungen aus
// dem Rechnungsarchiv (Zahlungseingänge von Kunden) mit den Kontoauszug-
// Buchungen in Firestore ab und trägt bei Treffern die Rechnungs-PDF als
// Beleg ein (Felder "scanFile"/"scanDataUri") - genau wie match-scans.js das
// für eingescannte Einkaufs-Belege macht, nur in die andere Richtung: hier
// sind es Einnahmen (Zahlungseingänge), nicht Ausgaben.
//
// Die Rechnungs-PDF liegt schon fertig in Firestore (rechnungsarchiv.pdfDataUri,
// von rechnung-erstellen.html erzeugt) - hier wird nichts neu erzeugt,
// sondern nur referenziert/kopiert, damit sie in kontoauszug.html über
// denselben "📄 Beleg ansehen"-Button sichtbar wird wie die Ausgaben-Scans.
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function parseGermanAmount(str) {
    if (!str) return null;
    const cleaned = String(str).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

// "TT.MM.JJJJ" -> "JJJJ-MM-TT"
function deToIso(deDate) {
    const parts = String(deDate || '').trim().split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function addDays(dateIso, days) {
    const d = new Date(dateIso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function main() {
    const [invoicesSnap, kontoauszugSnap] = await Promise.all([
        db.collection('rechnungsarchiv').get(),
        db.collection('kontoauszug').get()
    ]);

    const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const kontoauszug = kontoauszugSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const einnahmen = kontoauszug.filter(k => k.richtung === 'einnahme');

    console.log(`${invoices.length} Rechnung(en) im Archiv, ${einnahmen.length} Zahlungseingänge im Kontoauszug.\n`);

    let matched = 0, unmatched = 0, skippedNoPdf = 0;
    for (const inv of invoices) {
        if (!inv.pdfDataUri) { skippedNoPdf++; continue; }

        const invoiceIso = deToIso(inv.invoiceDate || inv.date);
        const invoiceAmount = parseGermanAmount(inv.amount);
        if (!invoiceIso || invoiceAmount == null) {
            console.log(`⚠ Konnte Datum/Betrag aus Rechnung "${inv.invoiceNumber || inv.id}" nicht lesen.`);
            unmatched++;
            continue;
        }

        // Zahlungseingang liegt meist 1-3 Tage bis einige Wochen nach
        // Rechnungsdatum (Vorauskasse bis übliches Zahlungsziel) - 3 Tage
        // Vorlauf (Vorauskasse-Fälle) bis 60 Tage Nachlauf, dieselbe
        // Toleranz wie in steuerreport.html.
        const windowStart = addDays(invoiceIso, -3);
        const windowEnd = addDays(invoiceIso, 60);

        const candidates = einnahmen.filter(k =>
            Math.abs((parseFloat(k.betrag) || 0) - invoiceAmount) < 0.01 &&
            k.dateIso >= windowStart && k.dateIso <= windowEnd
        );

        if (candidates.length === 0) {
            console.log(`❌ Kein Zahlungseingang gefunden für Rechnung "${inv.invoiceNumber || inv.id}" (${inv.invoiceDate}, ${invoiceAmount.toFixed(2)} €).`);
            unmatched++;
            continue;
        }

        const match = candidates[0];
        await db.collection('kontoauszug').doc(match.id).set({
            scanFile: inv.filename || `Rechnung_${inv.invoiceNumber}.pdf`,
            scanDataUri: inv.pdfDataUri
        }, { merge: true });

        console.log(`✅ Rechnung "${inv.invoiceNumber || inv.id}" -> ${match.date} ${match.betrag} € (${match.empfaenger || match.verwendungszweck || ''})`);
        matched++;
    }

    console.log(`\nFertig: ${matched} zugeordnet, ${unmatched} ohne Treffer, ${skippedNoPdf} ohne gespeicherte PDF übersprungen.`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
