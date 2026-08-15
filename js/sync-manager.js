/**
 * Zentrale Firebase & Synchronisations-Logik
 * Sorgt dafür, dass alle HTML-Dateien immer den gleichen Stand haben
 * und Konflikte anhand des genauen Zeitstempels gelöst werden.
 */

window.AppSync = (function() {
    let db = null;
    let firebaseInitialized = false;
    let listeners = [];
    
    // Status UI-Update Funktion (falls vorhanden in der HTML-Datei)
    function updateFirebaseStatus(status, message) {
        if (typeof window.updateFirebaseStatus === 'function') {
            window.updateFirebaseStatus(status, message);
        } else {
            // Fallback: Suche DOM-Elemente
            const dot = document.getElementById('firebaseStatusDot');
            const text = document.getElementById('firebaseStatusText');
            if (dot && text) {
                switch(status) {
                    case 'connected':
                        dot.style.background = '#4CAF50';
                        text.style.color = '#4CAF50';
                        text.textContent = message || '🟢 Live verbunden';
                        break;
                    case 'syncing':
                        dot.style.background = '#2196F3';
                        text.style.color = '#2196F3';
                        text.textContent = message || '🔄 Synchronisiere...';
                        break;
                    case 'error':
                        dot.style.background = '#f44336';
                        text.style.color = '#f44336';
                        text.textContent = message || '🔴 Getrennt';
                        break;
                    case 'connecting':
                        dot.style.background = '#ffc107';
                        text.style.color = '#ffc107';
                        text.textContent = message || '🟡 Verbinde...';
                        break;
                }
            }
        }
    }

    function sanitizeFirebaseId(id) {
        if (!id) return 'booking-' + Date.now();
        // Ersetze ungültige Zeichen durch Bindestriche, behalte nur Alphanumerisch, Bindestrich und Unterstrich
        return id.toString().replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    // Liest die aktuellen Buchungen aus dem localStorage
    function getLocalBookings() {
        try {
            return JSON.parse(localStorage.getItem('eisfavorite_bookings') || '[]');
        } catch(e) {
            console.error("Fehler beim Laden aus localStorage:", e);
            return [];
        }
    }

    // Hilfsfunktion: Berechnet einen sauberen Timestamp für Vergleiche
    function getTimestamp(booking) {
        return booking.lastModifiedMs || 
               (booking.lastModified ? new Date(booking.lastModified).getTime() : 0) || 
               (booking.aktualisiertAm ? parseDateSafe(booking.aktualisiertAm).getTime() : 0);
    }
    
    function parseDateSafe(dateString) {
        if (!dateString) return new Date(0);
        // Fallback-Parser für "DD.MM.YYYY HH:mm" falls nötig
        if (dateString.includes('.')) {
            try {
                const parts = dateString.split(' ');
                const dateParts = parts[0].split('.');
                if (parts[1]) {
                    const timeParts = parts[1].split(':');
                    return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
                }
                return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
            } catch(e) {
                return new Date(0);
            }
        }
        return new Date(dateString);
    }

    function initFirebase() {
        // Wir erzwingen ab sofort die Firebase-Verbindung für alle!
        localStorage.removeItem('firebaseSkipped');


        const defaultConfig = {
            apiKey: "AIzaSyDNtaUvAbjU2OHjLWNnNJyhkccoH9YlkYo",
            authDomain: "mailfavorite-e8f49.firebaseapp.com",
            projectId: "mailfavorite-e8f49",
            storageBucket: "mailfavorite-e8f49.firebasestorage.app",
            messagingSenderId: "73719715044",
            appId: "1:73719715044:web:e0e762cda49ae166b6c8f1",
            measurementId: "G-WGRT5L3NCX"
        };
        
        // Speichere die Config für andere Teile der App
        localStorage.setItem('firebaseConfig', JSON.stringify(defaultConfig));

        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK nicht geladen! Versuche es in 1 Sekunde erneut...');
            setTimeout(initFirebase, 1000);
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(defaultConfig);
            }
            db = firebase.firestore();
            firebaseInitialized = true;
            console.log('✅ Firebase Firestore (Zentrale) verbunden');
            
            startRealtimeSync();
        } catch (error) {
            console.error('❌ Firebase-Initialisierung fehlgeschlagen:', error);
            updateFirebaseStatus('error', '🔴 Fehler');
        }
    }

    // Horcht auf Änderungen in Firebase und fügt sie lokal ein (Konfliktlösung)
    function startRealtimeSync() {
        if (!firebaseInitialized || !db) return;

        db.collection('buchungen').onSnapshot((snapshot) => {
            // KEIN Blocking-Flag hier - der Listener muss immer laufen, sonst
            // verpassen wir Änderungen von anderen Geräten während wir selbst
            // gerade hochladen (echtes Live-Update). Rückkopplungen werden
            // stattdessen unten über den hasChanges-Vergleich vermieden.
            const firebaseBookings = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                delete data.updatedAt; // Firebase Timestamp ignorieren, wir nutzen lastModifiedMs
                firebaseBookings.push({ ...data, id: doc.id });
            });

            let localBookings = getLocalBookings();
            
            // WICHTIG: Merge-Strategie - IMMER die neueste Version anhand lastModifiedMs nehmen
            const mergedMap = new Map();
            let hasChanges = false;
            let shouldUploadLocal = false; // Flag: müssen lokale (neuere) Daten hochgeladen werden?

            // 1. Alle Firebase-Buchungen reinladen
            firebaseBookings.forEach(fb => {
                mergedMap.set(fb.id, { data: fb, ts: getTimestamp(fb), source: 'firebase' });
            });

            // 2. Mit lokalen Buchungen vergleichen
            localBookings.forEach(loc => {
                const locTs = getTimestamp(loc);
                const fbEntry = mergedMap.get(loc.id);

                if (fbEntry) {
                    if (locTs > fbEntry.ts) {
                        // LOKAL IST NEUER -> Lokale behalten, Firebase updaten
                        mergedMap.set(loc.id, { data: loc, ts: locTs, source: 'local-newer' });
                        hasChanges = true;
                        shouldUploadLocal = true;
                    } else if (locTs < fbEntry.ts) {
                        // FIREBASE IST NEUER -> Firebase behalten, lokal updaten
                        hasChanges = true;
                    }
                    // bei Gleichstand: Firebase Version behalten
                } else {
                    // Buchung existiert nur lokal und nicht in Firebase. Das ist
                    // nur dann "gerade erst lokal erstellt" (hochladen!), wenn sie
                    // frisch ist. Ist sie älter als 30s, wurde sie mit hoher
                    // Wahrscheinlichkeit auf einem anderen Gerät gelöscht - sonst
                    // würde jede Löschung vom Listener direkt wieder rückgängig
                    // gemacht (re-uploaded), sobald das nächste Snapshot ankommt.
                    const ageInSeconds = (Date.now() - locTs) / 1000;
                    if (ageInSeconds < 30) {
                        mergedMap.set(loc.id, { data: loc, ts: locTs, source: 'local-new' });
                        hasChanges = true;
                        shouldUploadLocal = true;
                    } else {
                        hasChanges = true; // aus dem lokalen Bestand entfernen
                    }
                }
            });

            if (localBookings.length === 0 && firebaseBookings.length > 0) hasChanges = true;
            
            const mergedArray = Array.from(mergedMap.values()).map(entry => entry.data);

            if (hasChanges) {
                // Schreibe gemergtes Array in localStorage
                localStorage.setItem('eisfavorite_bookings', JSON.stringify(mergedArray));
                
                // Benachrichtige die UI
                notifyListeners(mergedArray);

                // Falls wir neuere lokale Daten hatten, ab in die Cloud damit
                if (shouldUploadLocal) {
                    setTimeout(() => {
                        forceUploadToFirebase(mergedArray);
                    }, 500);
                }
            }

            updateFirebaseStatus('connected', '🟢 Live verbunden');

        }, (error) => {
            console.error('❌ Synchronisations-Fehler:', error);
            updateFirebaseStatus('error', '🔴 Sync-Fehler');
        });
    }

    // Speichert Buchungen (lokal + Push zu Firebase + Update andere Tabs)
    function saveBookings(newBookingsArray, skipTimestampUpdate = false) {
        if (!Array.isArray(newBookingsArray)) {
            console.error("saveBookings erwartet ein Array!");
            return;
        }

        // 1. Aktualisiere für jede geänderte Buchung den lastModifiedMs Timestamp
        if (!skipTimestampUpdate) {
            const oldBookings = getLocalBookings();
            const oldMap = new Map(oldBookings.map(b => [b.id, b]));
            
            newBookingsArray = newBookingsArray.map(booking => {
                const old = oldMap.get(booking.id);
                // Wenn sich was geändert hat oder es neu ist, setze den Timestamp frisch
                if (!old || JSON.stringify(old) !== JSON.stringify(booking)) {
                    booking.lastModifiedMs = Date.now();
                    // Für Abwärtskompatibilität aktualisiertAm
                    booking.aktualisiertAm = new Date().toLocaleString('de-DE'); 
                }
                return booking;
            });
        }

        // 2. Speichere lokal
        localStorage.setItem('eisfavorite_bookings', JSON.stringify(newBookingsArray));
        
        // 3. Benachrichtige die UI im AKTUELLEN Tab (damit z.B. das Dashboard direkt neu rendert)
        notifyListeners(newBookingsArray);

        // 4. Lade in die Cloud hoch
        forceUploadToFirebase(newBookingsArray);
    }

    let firebaseUploadTimeout = null;
    
    // Zwingt einen sofortigen/ge-debounceten Upload zu Firebase
    async function forceUploadToFirebase(bookingsToUpload) {
        if (!firebaseInitialized || !db) return;
        
        if (firebaseUploadTimeout) clearTimeout(firebaseUploadTimeout);
        
        // Kurzes Debounce, um nicht bei jedem Tastendruck sofort Firebase zu bomben
        firebaseUploadTimeout = setTimeout(async () => {
            try {
                updateFirebaseStatus('syncing', '🔄 Speichere...');

                const batch = db.batch();
                let count = 0;
                
                for (let i = 0; i < bookingsToUpload.length; i++) {
                    const booking = bookingsToUpload[i];
                    if (!booking.id) {
                        booking.id = 'booking-' + Date.now() + '-' + i;
                    }
                    
                    const cleanId = sanitizeFirebaseId(booking.id);
                    const cleanBooking = {};
                    
                    for (const key in booking) {
                        if (booking[key] !== undefined && booking[key] !== null) {
                            cleanBooking[key] = booking[key];
                        }
                    }

                    const docRef = db.collection('buchungen').doc(cleanId);
                    batch.set(docRef, {
                        ...cleanBooking,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    count++;
                }

                await batch.commit();
                console.log(`✅ ${count} Buchungen erfolgreich zu Firebase synchronisiert!`);
                
                updateFirebaseStatus('connected', '🟢 Gespeichert');
                setTimeout(() => updateFirebaseStatus('connected', '🟢 Live verbunden'), 1500);
            } catch (error) {
                console.error("Fehler beim Firebase-Upload:", error);
                updateFirebaseStatus('error', '🔴 Upload fehlgeschlagen');
            }
        }, 300); // 300ms Verzögerung
    }

    // Wenn ein anderer Tab (z.B. Dashboard) die Daten im localStorage ändert
    window.addEventListener('storage', (e) => {
        if (e.key === 'eisfavorite_bookings' && e.newValue) {
            console.log("🔄 Cross-Tab Update erkannt!");
            try {
                const updatedBookings = JSON.parse(e.newValue);
                notifyListeners(updatedBookings);
            } catch (err) {}
        }
    });

    function onDataChanged(callback) {
        listeners.push(callback);
    }

    function notifyListeners(data) {
        listeners.forEach(cb => cb(data));
    }

    // Öffentliche API
    return {
        init: initFirebase,
        getBookings: getLocalBookings,
        saveBookings: saveBookings,
        onDataChanged: onDataChanged,
        forceUpload: forceUploadToFirebase
    };
})();
