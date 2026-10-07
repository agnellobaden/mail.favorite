// Läuft DAUERHAFT auf dem PC mit dem angeschlossenen Drucker. Wartet auf
// Druckaufträge, die vom Handy aus über kassenbuch.html ("📲 An PC-Drucker
// senden") in Firestore abgelegt werden, rendert den Kassenbericht als PDF
// (per headless Chrome über den lokalen Webserver, damit der __authGate
// aus kassenbuch.html übersprungen wird - siehe "__isLocal" dort) und
// schickt ihn automatisch an den Standarddrucker.
//
// Start: node print-listener.js
// Läuft bis Strg+C / Fenster geschlossen - für Dauerbetrieb am besten als
// Windows-Aufgabenplanung-Task bei Anmeldung einrichten (siehe README unten).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APP_DIR = path.join(__dirname, '..');
const PORT = 5411;
const EXPORT_DIR = path.join(__dirname, 'exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

// Winziger lokaler Webserver, der genau denselben Ordner wie die Live-Seite
// ausliefert - headless Chrome ruft dann http://localhost statt der
// echten Domain auf, wodurch kassenbuch.html den Login-Gate überspringt
// (__isLocal-Check dort: hostname === 'localhost').
function startLocalServer() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            let urlPath = decodeURIComponent(req.url.split('?')[0]);
            if (urlPath === '/') urlPath = '/kassenbuch.html';
            const filePath = path.join(APP_DIR, urlPath);
            if (!filePath.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }
            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                const ext = path.extname(filePath);
                res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(PORT, () => resolve(server));
    });
}

// Erzeugt ein kurzlebiges Custom Token für den Owner-Account, damit sich
// die headless-Chrome-Instanz bei Firestore als echter angemeldeter Nutzer
// ausweisen kann (die Sicherheitsregeln lassen nur diesen Account zu).
async function createOwnerAuthToken() {
    const user = await admin.auth().getUserByEmail('agnello.baden@gmail.com');
    return admin.auth().createCustomToken(user.uid);
}

async function renderKassenberichtPdf(dates) {
    const authToken = await createOwnerAuthToken();
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        const page = await browser.newPage();
        await page.emulateMediaType('print');
        const url = `http://localhost:${PORT}/kassenbuch.html?datumListe=${encodeURIComponent(dates.join(','))}&authToken=${encodeURIComponent(authToken)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction('window.__autoDruckReady === true', { timeout: 20000 });
        const outPath = path.join(EXPORT_DIR, `Kassenbericht_${dates[0]}_${Date.now()}.pdf`);
        await page.pdf({ path: outPath, format: 'A4', printBackground: false, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
        return outPath;
    } finally {
        await browser.close();
    }
}

function printPdf(pdfPath) {
    return new Promise((resolve, reject) => {
        // Start-Process -Verb Print schickt die Datei an den Standarddrucker,
        // genau wie drucke-belege.ps1 das für die Belege-Sammel-PDF schon tut.
        execFile('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath "${pdfPath}" -Verb Print`], (err) => {
            if (err) reject(err); else resolve();
        });
    });
}

async function handleJob(doc) {
    const job = doc.data();
    console.log(`\n📨 Neuer Druckauftrag: ${job.typ}, Tage: ${(job.dates || []).join(', ')}`);
    try {
        if (job.typ === 'kassenbericht') {
            const pdfPath = await renderKassenberichtPdf(job.dates);
            console.log(`📄 PDF erstellt: ${pdfPath}`);
            await printPdf(pdfPath);
            console.log('🖨️ An den Drucker geschickt.');
            await doc.ref.set({ status: 'erledigt', erledigtAtMs: Date.now() }, { merge: true });
        } else {
            await doc.ref.set({ status: 'fehler', fehler: 'Unbekannter Auftragstyp: ' + job.typ }, { merge: true });
        }
    } catch (err) {
        console.error('❌ Fehler beim Verarbeiten:', err.message);
        await doc.ref.set({ status: 'fehler', fehler: err.message }, { merge: true }).catch(() => {});
    }
}

async function main() {
    await startLocalServer();
    console.log(`✅ Lokaler Server läuft auf http://localhost:${PORT}`);
    console.log('👂 Warte auf Druckaufträge vom Handy (Strg+C zum Beenden)...');

    db.collection('druckauftraege').where('status', '==', 'offen').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') handleJob(change.doc);
        });
    }, error => {
        console.error('Firestore-Fehler:', error);
    });
}

main();
