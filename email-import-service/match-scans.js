// Einmalig ausführbares Skript: gleicht die PDFs im scan/-Ordner (Beträge,
// Datum aus dem PDF-Text extrahiert) mit den Kontoauszug-Buchungen in
// Firestore ab und trägt bei Treffern den Dateinamen ein (Feld "scanFile"),
// damit die Buchhaltungsordner-Ansicht anzeigen kann, ob der Beleg
// tatsächlich eingescannt vorliegt.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const scanDir = path.join(__dirname, '..', 'scan');

function deToIso(deDate) {
    const [d, m, y] = deDate.split('.');
    return `${y}-${m}-${d}`;
}

function extractDateAndAmount(filePath) {
    let text;
    try {
        text = execSync(`pdftotext -layout "${filePath}" -`, { encoding: 'utf8' });
    } catch (err) {
        return null;
    }
    const dateMatch = text.match(/LIEFERDATUM:\s*(\d{2}\.\d{2}\.\d{4})/) || text.match(/RECHNUNGSDATUM:\s*(\d{2}\.\d{2}\.\d{4})/);
    const amountMatches = [...text.matchAll(/SUMME EUR\s*([\d.]+,\d{2})/g)];
    if (!dateMatch || amountMatches.length === 0) return null;
    const amountStr = amountMatches[amountMatches.length - 1][1].replace(/\./g, '').replace(',', '.');
    return { dateIso: deToIso(dateMatch[1]), amount: parseFloat(amountStr) };
}

async function main() {
    if (!fs.existsSync(scanDir)) {
        console.log('Kein scan/-Ordner gefunden:', scanDir);
        return;
    }
    const files = fs.readdirSync(scanDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`${files.length} PDF(s) im scan/-Ordner gefunden.\n`);

    const snapshot = await db.collection('kontoauszug').get();
    const kontoauszug = [];
    snapshot.forEach(doc => kontoauszug.push({ id: doc.id, ...doc.data() }));

    let matched = 0, unmatched = 0;
    for (const file of files) {
        const info = extractDateAndAmount(path.join(scanDir, file));
        if (!info) {
            console.log(`⚠ Konnte Datum/Betrag nicht aus "${file}" lesen.`);
            unmatched++;
            continue;
        }

        // Buchungsdatum liegt meist 1-3 Tage nach Kaufdatum (Kartenabrechnung).
        // Ältere, vor der "richtung"-Umstellung importierte Buchungen haben
        // dieses Feld noch nicht gesetzt - waren damals aber ausschließlich
        // Ausgaben, deshalb hier als Ausgabe behandeln.
        const candidates = kontoauszug.filter(k =>
            (k.richtung ? k.richtung === 'ausgabe' : true) &&
            Math.abs((parseFloat(k.betrag) || 0) - info.amount) < 0.01 &&
            k.dateIso >= info.dateIso &&
            k.dateIso <= addDays(info.dateIso, 5)
        );

        if (candidates.length === 0) {
            console.log(`❌ Kein Kontoauszug-Eintrag gefunden für "${file}" (${info.dateIso}, ${info.amount.toFixed(2)} €).`);
            unmatched++;
            continue;
        }

        const match = candidates[0];
        await db.collection('kontoauszug').doc(match.id).set({ scanFile: file }, { merge: true });
        console.log(`✅ "${file}" -> ${match.date} ${match.betrag} € (${match.empfaenger || match.verwendungszweck || ''})`);
        matched++;
    }

    console.log(`\nFertig: ${matched} zugeordnet, ${unmatched} ohne Treffer.`);
    process.exit(0);
}

function addDays(dateIso, days) {
    const d = new Date(dateIso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

main().catch(err => { console.error(err); process.exit(1); });
