#!/usr/bin/env node
/**
 * EisFavorite: Automatischer taeglicher Versand der Werbekampagne
 * (Vereine + Firmen, siehe werbung.html)
 *
 * Verschickt jeden Tag bis zu MAX_PER_DAY (100) E-Mails an Leads mit
 * Status "neu" (noch nie kontaktiert), sortiert nach Entfernung (naechste
 * zuerst), bis die Liste durch ist - danach passiert taeglich einfach
 * nichts mehr (0 gefunden), bis neue Leads mit Status "neu" dazukommen.
 *
 * Baut exakt dieselbe HTML-Mail wie buildFlyerEmail() in werbung.html nach
 * (gleiche Optik, gleicher Tracking-Pixel/Abmelde-Link/Klick-Tracking-Link),
 * damit die Kampagnen-Statistik im Dashboard unabhaengig vom Versandweg
 * konsistent bleibt. Versendet per Gmail-SMTP (nodemailer), nicht ueber die
 * Gmail-API/OAuth wie der manuelle Browser-Versand - dafuer unbeaufsichtigt
 * lauffaehig.
 *
 * Benoetigt dieselben lokalen Dateien wie import.js:
 *   - config.json                    { "gmailAppPassword": "..." }
 *   - firebase-service-account.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const CONFIG_PATH = path.join(__dirname, 'config.json');
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

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
    });
}
const db = admin.firestore();

const EMAIL = 'eisfavorit@gmail.com';
const MAX_PER_DAY = 100;
const CATEGORIES = ['verein', 'firma'];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL, pass: config.gmailAppPassword }
});

// ---- Ab hier 1:1 dieselbe Text-/HTML-Logik wie buildFlyerEmail() in werbung.html ----

const FLYER_COPY = {
    verein: {
        subjectPrefix: 'Eis für Ihr nächstes Vereinsfest - ',
        headline: lead => `Eis für Ihr nächstes Fest, ${lead.name}!`,
        subheadline: 'Der Eiswagen für Vereinsfeste, Jubiläen und Turniere.',
        body: lead => `ob Vereinsfest, Jubiläum, Turnier oder Grillabend - EisFavorite kommt mit dem Eiswagen ` +
            `zu <strong>${lead.name}</strong> und sorgt bei Ihren Mitgliedern und Gästen für eine süße Überraschung ` +
            `direkt vor Ort. Schon ab <strong>200 € Mindestumsatz</strong> sind wir für Ihre Veranstaltung dabei.`,
        features: [
            ['🚚', 'Wir kommen zu Ihrem Fest'],
            ['🍨', 'Frisches Eis vor Ort'],
            ['🎉', 'Highlight für Jung und Alt']
        ]
    },
    firma: {
        subjectPrefix: 'Eine süße Überraschung für das Team von ',
        headline: lead => `Eine süße Überraschung für das Team von ${lead.name}`,
        subheadline: 'Motivation, die schmilzt: Eis für Ihre Mitarbeiter als Dankeschön.',
        body: lead => `ob als spontane Belohnung, zum Sommerfest, Betriebsjubiläum oder einfach als Dankeschön für den ` +
            `Einsatz Ihres Teams bei <strong>${lead.name}</strong> - EisFavorite kommt mit dem Eiswagen zu Ihnen ` +
            `und verwöhnt Ihre Mitarbeiterinnen und Mitarbeiter mit frisch zubereitetem Eis direkt vor Ort. ` +
            `Schon ab <strong>200 € Mindestumsatz</strong> sind wir für Ihre Firmenfeier dabei.`,
        features: [
            ['🚚', 'Wir kommen zu Ihnen'],
            ['🍨', 'Frisches Eis vor Ort'],
            ['😊', 'Freude fürs Team']
        ]
    }
};

function buildFlyerGreeting(lead) {
    const cp = (lead.contactPerson || '').replace(/\(.*?\)/g, '').trim();
    const firstPerson = cp ? cp.split(',')[0].trim() : '';
    return firstPerson ? ('Hallo ' + firstPerson + ',') : 'Sehr geehrte Damen und Herren,';
}

function buildFlyerEmail(lead) {
    const copy = FLYER_COPY[lead.category] || FLYER_COPY.firma;
    const greeting = buildFlyerGreeting(lead);
    // Button führt IMMER direkt zur echten Website (nie über einen Zwischen-
    // Redirect) - Werbeblocker blockieren zuverlässig jede URL mit "track" im
    // Pfad, das würde den Klick sonst komplett verhindern. Das "🌐 Website
    // besucht"-Tracking läuft stattdessen als Hintergrund-Beacon auf eisfavorite.de.
    const websiteUrl = 'https://eisfavorite.de/?lead=' + encodeURIComponent(lead.id);
    const subject = copy.subjectPrefix + lead.name;
    const featuresHtml = copy.features.map(([icon, label], i) => `
        <td style="width:25%; text-align:center; padding:10px; background:#f8f9fa; border-radius:10px;">${icon}<br><span style="font-size:0.85em; font-weight:600; color:#333;">${label}</span></td>${i < copy.features.length - 1 ? '<td style="width:4%;"></td>' : ''}`).join('');
    const html = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:600px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #eee;">
  <img src="https://maileisfavorite.vercel.app/images/eiswagen.jpg" alt="EisFavorite Eiswagen" style="width:100%; display:block;">
  <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); background-color:#667eea; color:#ffffff; text-align:center; padding:32px 20px 40px;">
    <div style="font-size:2.4em; line-height:1;">🍦</div>
    <div style="font-weight:700; letter-spacing:0.5px; margin-top:6px;">EisFavorite</div>
    <h1 style="font-size:1.5em; margin:16px 0 8px;">${copy.headline(lead)}</h1>
    <p style="font-size:1.05em; opacity:0.95; margin:0;">${copy.subheadline}</p>
  </div>
  <div style="padding:28px 26px;">
    <p style="color:#333; font-size:1.05em; margin:0 0 16px;">${greeting}</p>
    <p style="color:#555; line-height:1.7; font-size:1.02em; margin:0 0 18px;">
      ${copy.body(lead)}
    </p>
    <table role="presentation" width="100%" style="border-collapse:collapse; margin:20px 0;">
      <tr>${featuresHtml}
      </tr>
    </table>
    <div style="text-align:center; margin:26px 0 10px;">
      <a href="${websiteUrl}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #ff9800 0%, #f57c00 100%); background-color:#f57c00; color:#ffffff; text-decoration:none; font-weight:700; font-size:1.1em; padding:15px 38px; border-radius:50px;">🍦 Jetzt unverbindlich anfragen</a>
      <p style="margin-top:10px; color:#888; font-size:0.85em;">Klicken Sie hier für mehr Infos und um direkt anzufragen</p>
    </div>
  </div>
  <div style="background:#f8f9fa; padding:22px 26px; text-align:center; color:#666; font-size:0.85em; line-height:1.8; border-top:1px solid #eee;">
    <strong style="color:#333;">Eis Agnello · EisFavorite</strong><br>
    <a href="${websiteUrl}" style="color:#667eea; text-decoration:none; font-weight:600;">www.eisfavorite.de</a><br>
    Favoritenstrasse 11 · 76456 Kuppenheim<br>
    Tel: +49 176 56813172 · eisfavorit@gmail.com<br><br>
    Kein Interesse? Einfach mit "Kein Interesse" antworten, oder
    <a href="https://maileisfavorite.vercel.app/api/e?event=unsubscribe&id=${encodeURIComponent(lead.id)}" style="color:#999;">hier von weiteren Werbe-Mails abmelden</a>.
  </div>
  <img src="https://maileisfavorite.vercel.app/api/e?event=open&id=${encodeURIComponent(lead.id)}" width="1" height="1" alt="" style="display:block; border:0;">
</div>`;
    return { subject, html };
}

// ---- Ende der aus werbung.html uebernommenen Logik ----

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: Automatischer Kampagnen-Versand (max ' + MAX_PER_DAY + '/Tag)');
    console.log('='.repeat(60));

    const snapshot = await db.collection('marketingLeads')
        .where('category', 'in', CATEGORIES)
        .get();

    let candidates = [];
    snapshot.forEach(doc => {
        const lead = { id: doc.id, ...doc.data() };
        if (!lead.email) return;
        if (lead.unsubscribed) return;
        if ((lead.status || 'neu') !== 'neu') return;
        candidates.push(lead);
    });

    candidates.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    const batch = candidates.slice(0, MAX_PER_DAY);

    console.log(`${candidates.length} unkontaktierte Leads gesamt, sende heute ${batch.length}.`);

    let sent = 0;
    let failed = 0;

    for (const lead of batch) {
        const { subject, html } = buildFlyerEmail(lead);
        try {
            await transporter.sendMail({
                from: `Eis Agnello <${EMAIL}>`,
                to: lead.email,
                subject: subject,
                html: html
            });

            const now = Date.now();
            await db.collection('marketingLeads').doc(lead.id).set({
                status: 'kontaktiert',
                lastContactedAt: now,
                lastModifiedMs: now
            }, { merge: true });

            console.log(`  ✓ ${lead.name} <${lead.email}> (${lead.distanceKm ?? '?'} km)`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Fehler bei ${lead.name} <${lead.email}>:`, err.message);
            failed++;
        }
        // Kleine Pause zwischen den Sendungen, um Gmail nicht zu ueberlasten.
        await new Promise(r => setTimeout(r, 1500));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Fertig. ${sent} gesendet, ${failed} fehlgeschlagen. Noch offen: ${candidates.length - sent}.`);
    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim automatischen Kampagnen-Versand:', err);
    process.exit(1);
});
