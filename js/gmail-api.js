// Gemeinsame Gmail-API-Anbindung (OAuth) für automatischen Hintergrund-Versand
// von E-Mails aus der App - ohne Compose-Fenster, ohne manuellen Senden-Klick.
//
// Einmalig einzurichten: Google-Cloud-OAuth-Client-ID unten eintragen
// (siehe ANLEITUNG-WERBUNG.md, Abschnitt "OAuth-Client-ID erstellen").
// Danach meldet sich der Nutzer einmal pro Browser-Sitzung mit
// eisfavorit@gmail.com an und erlaubt den Versand - ab dann läuft jeder
// Versand vollautomatisch im Hintergrund.
const GMAIL_OAUTH_CLIENT_ID = 'HIER_DEINE_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';

let _gmailAccessToken = null;
let _gmailTokenClient = null;

function _gmailEncodeMimeSubject(str) {
    return '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(str))) + '?=';
}

function _gmailBase64UrlEncodeUtf8(str) {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ensureGmailAuth(onReady) {
    if (GMAIL_OAUTH_CLIENT_ID.indexOf('HIER_DEINE') === 0) {
        alert('⚠️ Der automatische Gmail-Versand ist noch nicht eingerichtet.\n\n' +
              'In Google Cloud Console eine OAuth-Client-ID (Web-Anwendung) erstellen ' +
              'und in js/gmail-api.js bei GMAIL_OAUTH_CLIENT_ID eintragen. Details in ANLEITUNG-WERBUNG.md.');
        return;
    }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        alert('Google-Anmeldedienst konnte nicht geladen werden. Bitte Seite neu laden.');
        return;
    }
    if (!_gmailTokenClient) {
        _gmailTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GMAIL_OAUTH_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.send',
            callback: function(resp) {
                if (resp.error) {
                    alert('❌ Gmail-Anmeldung fehlgeschlagen: ' + resp.error);
                    return;
                }
                _gmailAccessToken = resp.access_token;
                onReady();
            }
        });
    }
    _gmailTokenClient.requestAccessToken({ prompt: _gmailAccessToken ? '' : 'consent' });
}

// Sendet eine reine Text-E-Mail automatisch im Hintergrund über die Gmail-API
// (kein Compose-Fenster, kein zusätzlicher Klick zum Absenden nötig).
function sendGmailApiMessage(to, subject, bodyText, onSuccess, onError) {
    _sendGmailApiRaw(to, 'text/plain', bodyText, subject, true, onSuccess, onError);
}

// Sendet eine gestaltete HTML-E-Mail automatisch im Hintergrund über die Gmail-API.
function sendGmailApiHtmlMessage(to, subject, html, onSuccess, onError, includeBcc) {
    _sendGmailApiRaw(to, 'text/html', html, subject, includeBcc !== false, onSuccess, onError);
}

function _sendGmailApiRaw(to, contentType, body, subject, includeBcc, onSuccess, onError) {
    if (!_gmailAccessToken) {
        ensureGmailAuth(() => _sendGmailApiRaw(to, contentType, body, subject, includeBcc, onSuccess, onError));
        return;
    }

    const raw = [
        'Content-Type: ' + contentType + '; charset="UTF-8"',
        'MIME-Version: 1.0',
        'To: ' + to,
        includeBcc ? 'Bcc: eisfavorit@gmail.com' : null,
        'Subject: ' + _gmailEncodeMimeSubject(subject),
        '',
        body
    ].filter(line => line !== null).join('\r\n');

    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + _gmailAccessToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: _gmailBase64UrlEncodeUtf8(raw) })
    }).then(res => {
        if (res.status === 401) {
            _gmailAccessToken = null;
            ensureGmailAuth(() => _sendGmailApiRaw(to, contentType, body, subject, includeBcc, onSuccess, onError));
            return;
        }
        if (!res.ok) {
            return res.text().then(t => { throw new Error('Status ' + res.status + ': ' + t); });
        }
        if (onSuccess) onSuccess();
    }).catch(err => {
        console.error('Gmail-Versand fehlgeschlagen:', err);
        if (onError) onError(err);
        else alert('❌ E-Mail konnte nicht gesendet werden: ' + err.message);
    });
}
