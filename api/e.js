// Vercel Serverless Function: Tracking fuer die Firmen-/Vereine-Werbekampagne
// (werbung.html) - E-Mail-geoeffnet-Pixel, Klick-Weiterleitung, Abmelden, und
// per Beacon von eisfavorite.de gemeldete Website-Besuche/Anfragen/Planer-
// Nutzung. Schreibt per firebase-admin direkt in Firestore (marketingLeads),
// damit KEINE oeffentlichen Firestore-Schreibrechte fuer Besucher noetig sind
// - das laeuft komplett ueber diese Funktion mit dem Service-Account.

const admin = require('firebase-admin');

if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON fehlt in den Vercel-Umgebungsvariablen.');
    } else {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(raw))
        });
    }
}

const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
    'base64'
);

const ALLOWED_ORIGINS = [
    'https://eisfavorite.de',
    'https://www.eisfavorite.de'
];

function setCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
}

async function markLead(id, fields) {
    if (!id || !admin.apps.length) return;
    try {
        await admin.firestore().collection('marketingLeads').doc(id).set(fields, { merge: true });
    } catch (err) {
        console.error('Konnte Lead nicht aktualisieren:', id, err.message);
    }
}

function unsubscribePage(success) {
    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>Abgemeldet - EisFavorite</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px;}
.box{background:white;border-radius:16px;padding:40px;max-width:420px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);}
h1{color:#667eea;font-size:1.4em;margin-bottom:12px;}
p{color:#666;line-height:1.5;}
</style></head><body>
<div class="box">
${success
    ? '<h1>✅ Erfolgreich abgemeldet</h1><p>Sie erhalten von uns keine weiteren Werbe-E-Mails mehr. Vielen Dank für Ihre Rückmeldung!</p>'
    : '<h1>⚠️ Link ungültig</h1><p>Dieser Abmelde-Link konnte nicht zugeordnet werden.</p>'}
</div></body></html>`;
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        setCors(req, res);
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        setCors(req, res);
        try {
            const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
            const { event, id, type } = body;
            if (event === 'visit') {
                await markLead(id, { websiteVisited: true, websiteVisitedAt: Date.now() });
            } else if (event === 'conversion') {
                const field = type === 'planer' ? 'usedPlaner' : 'usedAnfrage';
                await markLead(id, { [field]: true, [field + 'At']: Date.now() });
            }
            res.status(204).end();
        } catch (err) {
            res.status(400).json({ error: 'invalid request' });
        }
        return;
    }

    // GET: open-Pixel, Klick-Weiterleitung, Abmelden
    const { event, id, dest } = req.query;

    if (event === 'open') {
        await markLead(id, { emailOpened: true, emailOpenedAt: Date.now() });
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(TRANSPARENT_GIF);
        return;
    }

    if (event === 'click') {
        await markLead(id, { websiteVisited: true, websiteVisitedAt: Date.now(), emailClicked: true, emailClickedAt: Date.now() });
        let target = dest || 'https://eisfavorite.de';
        try {
            const url = new URL(target);
            if (id) url.searchParams.set('lead', id);
            target = url.toString();
        } catch (e) { /* dest ungueltig - unveraendert weiterleiten */ }
        res.writeHead(302, { Location: target });
        res.end();
        return;
    }

    if (event === 'unsubscribe') {
        if (id) {
            await markLead(id, { unsubscribed: true, unsubscribedAt: Date.now(), status: 'archiviert' });
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(unsubscribePage(!!id));
        return;
    }

    res.status(400).json({ error: 'unknown event' });
};
