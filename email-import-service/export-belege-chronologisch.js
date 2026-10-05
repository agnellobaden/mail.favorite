// Einmalig ausführbares Skript: baut EINE einzige PDF-Datei mit allen Belegen
// (Einkaufs-Scans von match-scans.js UND eigene Rechnungen von
// match-invoices.js), chronologisch nach Datum sortiert - zum Ausdrucken
// oder direkt an den Steuerberater weitergeben, wie ein digitaler
// Pendant-Ordner. Liest nur, was schon in Firestore (kontoauszug.scanFile/
// scanDataUri) hinterlegt ist - erzeugt keine neuen Scans/Rechnungen.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const OUT_DIR = path.join(__dirname, 'exports');
const OUT_FILE = path.join(OUT_DIR, `Belege_chronologisch_${new Date().toISOString().slice(0, 10)}.pdf`);

function formatEuro(n) {
    return (parseFloat(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function parseDataUri(dataUri) {
    const m = dataUri.match(/^data:([^;,]+)[^,]*,(.*)$/s);
    if (!m) return null;
    return { mime: m[1], bytes: Buffer.from(m[2], 'base64') };
}

async function main() {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const snapshot = await db.collection('kontoauszug').get();
    const entries = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.scanFile && e.scanDataUri)
        .sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || ''));

    console.log(`${entries.length} Belege mit Vorschau gefunden, baue PDF...\n`);
    if (entries.length === 0) {
        console.log('Keine Belege zum Exportieren vorhanden.');
        process.exit(0);
    }

    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);

    let included = 0, failed = 0;
    for (const e of entries) {
        const parsed = parseDataUri(e.scanDataUri);
        if (!parsed) { console.log(`⚠ Konnte Beleg nicht lesen: ${e.scanFile}`); failed++; continue; }

        const isEinnahme = e.richtung === 'einnahme';
        const caption = `${e.date || e.dateIso || '-'}  |  ${isEinnahme ? '+' : '-'}${formatEuro(e.betrag)}  |  ` +
            `${(e.empfaenger ? e.empfaenger + ' - ' : '') + (e.verwendungszweck || e.buchungstext || '')}`.slice(0, 110);

        try {
            if (parsed.mime === 'application/pdf') {
                const srcDoc = await PDFDocument.load(parsed.bytes, { ignoreEncryption: true });
                const pageIndices = srcDoc.getPageIndices();
                const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);
                copiedPages.forEach((p, i) => {
                    outDoc.addPage(p);
                    // Beschriftung nur auf der ersten Seite jedes Belegs, oben als schmaler Streifen.
                    if (i === 0) {
                        p.drawRectangle({ x: 0, y: p.getHeight() - 16, width: p.getWidth(), height: 16, color: rgb(1, 1, 0.85) });
                        p.drawText(caption, { x: 4, y: p.getHeight() - 12, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
                    }
                });
            } else if (parsed.mime === 'image/jpeg' || parsed.mime === 'image/jpg') {
                const img = await outDoc.embedJpg(parsed.bytes);
                addImagePage(outDoc, img, caption, font, boldFont);
            } else if (parsed.mime === 'image/png') {
                const img = await outDoc.embedPng(parsed.bytes);
                addImagePage(outDoc, img, caption, font, boldFont);
            } else {
                console.log(`⚠ Unbekanntes Format "${parsed.mime}" bei ${e.scanFile} - übersprungen.`);
                failed++;
                continue;
            }
            included++;
        } catch (err) {
            console.log(`⚠ Fehler bei "${e.scanFile}": ${err.message}`);
            failed++;
        }
    }

    const outBytes = await outDoc.save();
    fs.writeFileSync(OUT_FILE, outBytes);

    console.log(`\nFertig: ${included} Belege eingefügt, ${failed} übersprungen.`);
    console.log(`Gespeichert unter: ${OUT_FILE}`);
    console.log(`Gesamtgröße: ${(outBytes.length / 1024 / 1024).toFixed(1)} MB, ${outDoc.getPageCount()} Seiten.`);
    process.exit(0);
}

// A4-Seite (595x842pt) mit Datum/Betrag/Empfänger-Kopfzeile und dem Beleg-
// Bild darunter, so groß wie auf die Seite passt (Seitenverhältnis erhalten).
function addImagePage(outDoc, img, caption, font, boldFont) {
    const pageWidth = 595, pageHeight = 842;
    const page = outDoc.addPage([pageWidth, pageHeight]);

    page.drawRectangle({ x: 0, y: pageHeight - 24, width: pageWidth, height: 24, color: rgb(1, 1, 0.85) });
    page.drawText(caption, { x: 8, y: pageHeight - 17, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

    const margin = 20;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - 24 - margin * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale, h = img.height * scale;
    page.drawImage(img, {
        x: (pageWidth - w) / 2,
        y: margin + (maxH - h) / 2,
        width: w,
        height: h
    });
}

main().catch(err => { console.error(err); process.exit(1); });
