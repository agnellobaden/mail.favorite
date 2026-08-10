// Einmalig ausführbares Skript: gleicht die PDFs im scan/-Ordner (Beträge,
// Datum aus dem PDF-Text extrahiert) mit den Kontoauszug-Buchungen in
// Firestore ab und trägt bei Treffern den Dateinamen ein (Feld "scanFile"),
// damit die Buchhaltungsordner-Ansicht anzeigen kann, ob der Beleg
// tatsächlich eingescannt vorliegt. Die PDF selbst wird als Base64-Data-URI
// mitgespeichert (Feld "scanDataUri"), damit man sie direkt im Browser
// öffnen kann - genau wie die Rechnungs-PDFs im Rechnungsarchiv.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const scanDir = path.join(__dirname, '..', 'scan');

// Läuft auch außerhalb von Git Bash (z.B. über die Windows-Aufgabenplanung),
// wo "pdftotext" nicht automatisch im PATH ist - dort liegt es als Teil von
// Git for Windows mit, deshalb der konkrete Pfad als Fallback.
const PDFTOTEXT_CANDIDATES = [
    'pdftotext',
    'C:\\Users\\aagne\\AppData\\Local\\Programs\\Git\\mingw64\\bin\\pdftotext.exe'
];

function deToIso(deDate) {
    const [d, m, y] = deDate.split('.');
    // Manche Lieferanten (z.B. Fritz Köllemann) drucken das Jahr zweistellig
    const yyyy = y.length === 2 ? '20' + y : y;
    return `${yyyy}-${m}-${d}`;
}

const GERMAN_MONTHS = {
    januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06',
    juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12'
};

// Amazon-Rechnungen schreiben das Datum manchmal als "12 Juli 2026" statt DD.MM.YYYY
function germanTextDateToIso(day, monthName, year) {
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    if (!month) return null;
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function runPdftotext(filePath) {
    for (const cmd of PDFTOTEXT_CANDIDATES) {
        try {
            // OHNE -layout, damit Datum/Betrag-Parsing robuster funktioniert
            return execSync(`"${cmd}" "${filePath}" -`, { encoding: 'utf8' });
        } catch (err) {
            continue;
        }
    }
    return null;
}

// Manche Lieferanten (z.B. Metro) beliefern zwei verschiedene Kunden-Konten
// des Inhabers - "Snack-Oase" und "Mobiler Eisverkauf Agnello"/EisFavorite.
// Funktioniert für JEDEN Beleg, nicht nur Metro: zuerst das exakte
// Metro-Format (Name auf derselben Zeile wie "KUNDE:"), sonst als Fallback
// eine einfache Stichwortsuche über den ganzen Belegtext - damit auch
// Tankquittungen, Amazon-Rechnungen usw. erkannt werden, sofern einer der
// beiden Namen irgendwo drauf steht.
function extractKunde(text) {
    const kundeLine = text.match(/^(.*?)\s{2,}KUNDE:/m);
    if (kundeLine) return kundeLine[1].trim();

    if (/snack-?oase/i.test(text)) return 'Snack-Oase';
    if (/mobiler eisverkauf|eisfavorite|eiswagen/i.test(text)) return 'Mobiler Eisverkauf Agnello';
    return null;
}

function parseGermanNumber(str) {
    return parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
}

// Metro-Rechnungen (und ähnliche) weisen die MwSt oft AUF DERSELBEN
// Rechnung in mehreren Sätzen aus (z.B. Lebensmittel 7% + sonstige Waren
// 19%, jeweils mit eigener Zeile "Nettowert A/B=Satz% MwSt Brutto"). Statt
// einen einzigen Satz auf den Gesamtbetrag zu schätzen, wird hier jede
// Zeile einzeln gelesen und die tatsächlich ausgewiesene Vorsteuer exakt
// aufsummiert - damit ans Finanzamt weder zu viel noch zu wenig geht.
function extractMwstBreakdown(text) {
    const regex = /([\d.]+,\d{2})\s+[A-Z]=\s*(\d+),\d{2}%\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/g;
    const lines = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        lines.push({
            netto: parseGermanNumber(m[1]),
            satz: parseInt(m[2], 10),
            mwst: parseGermanNumber(m[3]),
            brutto: parseGermanNumber(m[4])
        });
    }
    return lines;
}

// Fritz Köllemann (und ähnliche) drucken am Ende eine Gesamtzeile
// "<Nettosumme> <Vorsteuer> <Bruttosumme> EUR" - da diese Zeile durch
// pdftotext ohne -layout oft durcheinandergewürfelt wird, wird hier NICHT
// blind das erste Zahlentripel vor "EUR" genommen, sondern nur eines, bei
// dem Netto + Vorsteuer tatsächlich exakt die Bruttosumme ergeben (sonst
// lieber gar keine exakte Vorsteuer behaupten).
function extractTotalsTriple(text) {
    const regex = /([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*EUR/g;
    let m, best = null;
    while ((m = regex.exec(text)) !== null) {
        const netto = parseGermanNumber(m[1]);
        const vat = parseGermanNumber(m[2]);
        const brutto = parseGermanNumber(m[3]);
        if (Math.abs(netto + vat - brutto) < 0.02) {
            best = { netto, vat, brutto }; // letzten Treffer nehmen (= Gesamtsumme, nicht Teilsumme)
        }
    }
    return best;
}

function extractDateAndAmount(filePath) {
    const text = runPdftotext(filePath);
    if (!text) return null;
    // Case-insensitive und erlaubt Zeilenumbruch zwischen Label und Datum ([\s\S]*? matched alles inkl. Newlines)
    let dateMatch = text.match(/LIEFERDATUM:?[\s\S]{0,50}?(\d{2}\.\d{2}\.\d{4})/i) ||
                      text.match(/RECHNUNGSDATUM:?[\s\S]{0,50}?(\d{2}\.\d{2}\.\d{4})/i) ||
                      text.match(/Rechnungsdatum:[\s\S]{0,50}?(\d{2}\.\d{2}\.\d{4})/) || // Für Steuerberater-Format
                      text.match(/\bRE\d+\s+(\d{2}\.\d{2}\.\d{2})\b/); // Fritz Köllemann: "RE332829 23.07.26"
    let dateIso = dateMatch ? deToIso(dateMatch[1]) : null;

    // Amazon-Format: "Rechnungsdatum /Lieferdatum Rechnungsnummer Zahlbetrag" gefolgt
    // von einer Zeile wie "12 Juli 2026 DE... 10,39" oder "09.06.2026 DE... 26,99".
    // Unabhängig von obigem Datums-Fallback prüfen (der wegen des Teilstrings
    // "Lieferdatum" manchmal schon zufällig zuschlägt, ohne dass danach auch
    // der Betrag gefunden wurde).
    let amazonAmount = null;
    const amazonLineNum = text.match(/Zahlbetrag\s*\n?\s*(\d{1,2})\.(\d{2})\.(\d{4})\s+\S+\s+([\d.]+,\d{2})/);
    const amazonLineText = !amazonLineNum ? text.match(/Zahlbetrag\s*\n?\s*(\d{1,2})\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s+\S+\s+([\d.]+,\d{2})/) : null;
    if (amazonLineNum) {
        amazonAmount = parseGermanNumber(amazonLineNum[4]);
        if (!dateIso) dateIso = `${amazonLineNum[3]}-${amazonLineNum[2]}-${amazonLineNum[1].padStart(2, '0')}`;
    } else if (amazonLineText) {
        amazonAmount = parseGermanNumber(amazonLineText[4]);
        if (!dateIso) dateIso = germanTextDateToIso(amazonLineText[1], amazonLineText[2], amazonLineText[3]);
    }

    const amountMatches = [...text.matchAll(/SUMME EUR\s*([\d.]+,\d{2})/g)];

    // Fallback: Suche nach Betrag in anderen Formaten (z.B. "zahlender Betrag", "Rechnungsbetrag von X EUR")
    // Reihenfolge wichtig: Spezifischere Patterns zuerst!
    if (amountMatches.length === 0) {
        const fallbackAmount = text.match(/Rechnungsbetrag von ([\d.]+,\d{2})/i) ||  // Steuerberater-Rechnung
                               text.match(/zahlende[rn]?\s+Betrag[\s\S]{0,20}?([\d.]+,\d{2})/i) ||
                               text.match(/Gesamtbetrag[\s\S]{0,20}?([\d.]+,\d{2})/i);
        if (fallbackAmount) amountMatches.push(fallbackAmount);
    }

    const totalsTriple = extractTotalsTriple(text);

    let amount = null;
    if (amountMatches.length > 0) {
        amount = parseGermanNumber(amountMatches[amountMatches.length - 1][1]);
    } else if (amazonAmount != null) {
        amount = amazonAmount;
    } else if (totalsTriple) {
        amount = totalsTriple.brutto;
    }

    if (!dateIso || amount == null) return null;

    const mwstLines = extractMwstBreakdown(text);
    let vorsteuerExact = null;
    if (mwstLines.length > 0) {
        const summe = mwstLines.reduce((s, l) => s + l.brutto, 0);
        // Nur übernehmen, wenn die Summe der Einzelzeilen zum
        // Rechnungsgesamtbetrag passt (Rundungstoleranz 2 Cent) - sonst
        // lieber gar nichts Exaktes behaupten als etwas Falsches.
        if (Math.abs(summe - amount) < 0.02) {
            vorsteuerExact = Math.round(mwstLines.reduce((s, l) => s + l.mwst, 0) * 100) / 100;
        }
    } else if (totalsTriple && Math.abs(totalsTriple.brutto - amount) < 0.02) {
        vorsteuerExact = Math.round(totalsTriple.vat * 100) / 100;
    }

    return { dateIso, amount, kunde: extractKunde(text), vorsteuerExact };
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

        // Buchungsdatum liegt meist 1-3 Tage nach Kaufdatum (Kartenabrechnung),
        // aber bei Rechnungen (z.B. Steuerberater) können auch Wochen vergehen.
        // Daher großzügige 60 Tage Toleranz.
        // Ältere, vor der "richtung"-Umstellung importierte Buchungen haben
        // dieses Feld noch nicht gesetzt - waren damals aber ausschließlich
        // Ausgaben, deshalb hier als Ausgabe behandeln.
        const candidates = kontoauszug.filter(k =>
            (k.richtung ? k.richtung === 'ausgabe' : true) &&
            Math.abs((parseFloat(k.betrag) || 0) - info.amount) < 0.01 &&
            k.dateIso >= info.dateIso &&
            k.dateIso <= addDays(info.dateIso, 60)
        );

        if (candidates.length === 0) {
            console.log(`❌ Kein Kontoauszug-Eintrag gefunden für "${file}" (${info.dateIso}, ${info.amount.toFixed(2)} €).`);
            unmatched++;
            continue;
        }

        const match = candidates[0];
        const pdfPath = path.join(scanDir, file);
        const pdfBytes = fs.readFileSync(pdfPath);
        const fields = { scanFile: file };
        if (info.kunde) {
            fields.kunde = info.kunde;
            fields.kundeSource = 'scan'; // erkannt aus dem Beleg - im UI nicht überschreibbar
        }
        if (info.vorsteuerExact != null) {
            fields.vorsteuerExact = info.vorsteuerExact; // exakt aus dem Beleg gelesen, ersetzt die Schätzung per einzelnem MwSt-Satz
        }

        // Firestore-Dokumente dürfen max. 1 MB groß sein - bei größeren
        // Scans (z.B. hochauflösende Mehrseiten-Scans) nur den Dateinamen
        // speichern, keine Data-URI.
        if (pdfBytes.length < 700 * 1024) {
            fields.scanDataUri = 'data:application/pdf;base64,' + pdfBytes.toString('base64');
        } else {
            console.log(`ℹ "${file}" ist zu groß (${(pdfBytes.length / 1024).toFixed(0)} KB) - nur Dateiname gespeichert, keine Data-URI.`);
        }

        await db.collection('kontoauszug').doc(match.id).set(fields, { merge: true });
        console.log(`✅ "${file}" -> ${match.date} ${match.betrag} € (${match.empfaenger || match.verwendungszweck || ''})${info.kunde ? ' [' + info.kunde + ']' : ''}${info.vorsteuerExact != null ? ' [Vorsteuer exakt: ' + info.vorsteuerExact.toFixed(2) + ' €]' : ' [Vorsteuer: geschätzt]'}`);
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
