const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./firebase-service-account.json')) });
admin.firestore().collection('marketingLeads').limit(1).get()
  .then(() => { console.log('OK - Firestore erreichbar'); process.exit(0); })
  .catch(err => { console.error('FEHLER:', err.code, err.message); process.exit(1); });
