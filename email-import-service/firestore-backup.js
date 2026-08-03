#!/usr/bin/env node
/**
 * EisFavorite: Tägliches Firestore-Backup
 *
 * Exportiert alle Firestore-Sammlungen (Buchungen, Rechnungsarchiv,
 * Zahlungserinnerungen, Marketing-Leads, Rechnungsnummern-Zähler, ...) als
 * eine einzelne JSON-Datei nach email-import-service/backups/. Sammlungen
 * werden dynamisch ermittelt (listCollections()), damit neue Sammlungen
 * automatisch mit gesichert werden, ohne dieses Skript anpassen zu müssen.
 *
 * Behält die letzten BACKUP_RETENTION_DAYS Tage, ältere Backups werden
 * automatisch gelöscht, damit der Ordner nicht unbegrenzt wächst.
 *
 * Die Backups landen NUR lokal (email-import-service/backups/ ist in
 * .gitignore) - sie enthalten echte Kundendaten und gehören nicht ins
 * Git-Repository.
 *
 * Benötigt dieselbe lokale Datei wie import.js:
 *   - firebase-service-account.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_RETENTION_DAYS = 30;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ firebase-service-account.json fehlt. Bitte erst anlegen (siehe README.md, Abschnitt "Einrichtung").');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
    });
}
const db = admin.firestore();

// Firestore-Timestamp-Objekte (falls vorhanden) in ISO-Strings umwandeln,
// damit JSON.stringify sie lesbar statt als leeres Objekt ausgibt.
function serializeValue(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serializeValue(v);
        }
        return out;
    }
    return value;
}

async function run() {
    console.log('='.repeat(60));
    console.log('EisFavorite: Tägliches Firestore-Backup');
    console.log('='.repeat(60));

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const collections = await db.listCollections();
    const backup = {};
    let totalDocs = 0;

    for (const col of collections) {
        const snapshot = await col.get();
        backup[col.id] = {};
        snapshot.forEach(doc => {
            backup[col.id][doc.id] = serializeValue(doc.data());
        });
        console.log(`  ✓ ${col.id}: ${snapshot.size} Dokument(e)`);
        totalDocs += snapshot.size;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `firestore-backup-${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filePath, JSON.stringify({
        exportedAt: now.toISOString(),
        collections: Object.keys(backup),
        totalDocuments: totalDocs,
        data: backup
    }, null, 2), 'utf8');

    console.log(`\n✓ Backup gespeichert: ${filePath} (${totalDocs} Dokumente insgesamt)`);

    // Alte Backups aufräumen
    const cutoffMs = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('firestore-backup-') && f.endsWith('.json'));
    let deleted = 0;
    for (const f of files) {
        const fullPath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoffMs) {
            fs.unlinkSync(fullPath);
            deleted++;
        }
    }
    if (deleted > 0) {
        console.log(`✓ ${deleted} Backup(s) älter als ${BACKUP_RETENTION_DAYS} Tage gelöscht.`);
    }

    console.log('='.repeat(60));
}

run().catch(err => {
    console.error('❌ Fehler beim Firestore-Backup:', err);
    process.exit(1);
});
