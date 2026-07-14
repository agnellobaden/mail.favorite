#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E-Mail Importer für Eisfavorite Buchungen
Ruft E-Mails von Gmail ab und extrahiert Buchungsinformationen
"""

import imaplib
import email
from email.header import decode_header
import re
import json
from datetime import datetime
import os

# Konfiguration
EMAIL = "eisfavorit@gmail.com"
PASSWORD = ""  # App-Passwort hier eintragen (siehe Anleitung unten)
IMAP_SERVER = "imap.gmail.com"
OUTPUT_FILE = "neue-anfragen.json"

# Regex-Muster für verschiedene Informationen
PATTERNS = {
    'name': [
        r'Name:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)',
        r'Von:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)',
        r'Kontakt:?\s*([A-ZÄÖÜa-zäöüß\s]+(?:\s+[A-ZÄÖÜa-zäöüß]+)+)',
    ],
    'email': [
        r'E-?Mail:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
        r'Email:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
        r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    ],
    'phone': [
        r'Tel(?:efon)?:?\s*(\+?[0-9\s\-\(\)\/]+)',
        r'Telefon:?\s*(\+?[0-9\s\-\(\)\/]+)',
        r'Mobil:?\s*(\+?[0-9\s\-\(\)\/]+)',
        r'(\+49\s*[0-9\s\-\/]+)',
        r'(0[0-9]{2,5}\s*[0-9\s\-\/]+)',
    ],
    'date': [
        r'Datum:?\s*(\d{1,2}\.\d{1,2}\.\d{4})',
        r'Termin:?\s*(\d{1,2}\.\d{1,2}\.\d{4})',
        r'am\s+(\d{1,2}\.\d{1,2}\.\d{4})',
        r'(\d{1,2}\.\d{1,2}\.\d{2,4})',
    ],
    'time': [
        r'Uhrzeit:?\s*(\d{1,2}:\d{2})',
        r'um\s+(\d{1,2}:\d{2})',
        r'ab\s+(\d{1,2}:\d{2})',
        r'(\d{1,2}:\d{2})\s*Uhr',
    ],
    'guests': [
        r'Gäste:?\s*(\d+)',
        r'Personen:?\s*(\d+)',
        r'Anzahl:?\s*(\d+)',
        r'(\d+)\s+Gäste',
        r'(\d+)\s+Personen',
    ],
    'street': [
        r'Straße:?\s*([A-ZÄÖÜa-zäöüß\s]+\d+[a-z]?)',
        r'Adresse:?\s*([A-ZÄÖÜa-zäöüß\s]+\d+[a-z]?)',
    ],
    'plz': [
        r'PLZ:?\s*(\d{5})',
        r'(\d{5})\s+[A-ZÄÖÜa-zäöüß]',
    ],
    'city': [
        r'Stadt:?\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+)',
        r'Ort:?\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+)',
        r'\d{5}\s+([A-ZÄÖÜa-zäöüß][a-zäöüß]+)',
    ],
    'company': [
        r'Firma:?\s*([A-ZÄÖÜa-zäöüß0-9\s&\.\-]+)',
        r'Unternehmen:?\s*([A-ZÄÖÜa-zäöüß0-9\s&\.\-]+)',
    ],
    'sorten': [
        r'Sorten?:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)',
        r'Geschmack:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)',
        r'Wunsch:?\s*([A-ZÄÖÜa-zäöüß\s,\-]+)',
    ],
}


def extract_info(text, field):
    """Extrahiert Informationen aus Text basierend auf Feld-Mustern"""
    if field not in PATTERNS:
        return None

    for pattern in PATTERNS[field]:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            result = match.group(1).strip()
            # Bereinigung
            if field == 'phone':
                result = re.sub(r'\s+', ' ', result)
            elif field == 'date':
                # Normalisiere Datum auf DD.MM.YYYY
                parts = result.split('.')
                if len(parts) == 3 and len(parts[2]) == 2:
                    result = f"{parts[0]}.{parts[1]}.20{parts[2]}"
            return result
    return None


def decode_email_subject(subject):
    """Dekodiert E-Mail-Betreff"""
    decoded_parts = decode_header(subject)
    decoded_subject = ""
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            decoded_subject += part.decode(encoding or 'utf-8', errors='ignore')
        else:
            decoded_subject += part
    return decoded_subject


def get_email_body(msg):
    """Extrahiert den E-Mail-Body"""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain":
                try:
                    body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                except:
                    try:
                        body = part.get_payload(decode=True).decode('latin-1', errors='ignore')
                    except:
                        pass
                break
    else:
        try:
            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
        except:
            try:
                body = msg.get_payload(decode=True).decode('latin-1', errors='ignore')
            except:
                pass
    return body


def parse_email(msg):
    """Parst eine E-Mail und extrahiert Buchungsinformationen"""
    subject = decode_email_subject(msg.get("Subject", ""))
    from_email = msg.get("From", "")
    date_received = msg.get("Date", "")
    body = get_email_body(msg)

    # Kombiniere Subject und Body für die Extraktion
    full_text = f"{subject}\n{body}"

    # Extrahiere Informationen
    booking = {
        'id': '',  # Wird später gesetzt
        'status': 'Neu',
        'name': extract_info(full_text, 'name') or extract_info(from_email, 'name') or '',
        'email': extract_info(full_text, 'email') or extract_info(from_email, 'email') or '',
        'phone': extract_info(full_text, 'phone') or '',
        'company': extract_info(full_text, 'company') or '',
        'date': extract_info(full_text, 'date') or '',
        'time': extract_info(full_text, 'time') or '',
        'timeEnd': '',
        'guests': extract_info(full_text, 'guests') or '',
        'kugelPerGuest': '',
        'location': '',
        'street': extract_info(full_text, 'street') or '',
        'plz': extract_info(full_text, 'plz') or '',
        'city': extract_info(full_text, 'city') or '',
        'distance': '',
        'wunschsorten': extract_info(full_text, 'sorten') or '',
        'notizen': body[:500] if body else '',  # Erste 500 Zeichen als Notizen
        'eigeneNotizen': f'Importiert aus E-Mail vom {date_received}',
        'angebotUrl': '',
        'angebotVorlage': '',
        'rechnungUrl': '',
        'erstelltAm': datetime.now().strftime('%d.%m.%Y'),
        'aktualisiertAm': datetime.now().strftime('%d.%m.%Y'),
        '_email_subject': subject,
        '_email_from': from_email,
        '_email_date': date_received,
    }

    return booking


def fetch_emails(email_address, password, days=7):
    """Ruft E-Mails der letzten X Tage ab"""
    try:
        # Verbindung zu Gmail herstellen
        print(f"Verbinde zu {IMAP_SERVER}...")
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)

        print(f"Login als {email_address}...")
        mail.login(email_address, password)

        # INBOX auswählen
        mail.select("INBOX")

        # Suche nach E-Mails der letzten X Tage
        date_filter = (datetime.now().date()).strftime("%d-%b-%Y")
        print(f"Suche E-Mails seit {date_filter}...")

        # Alle ungelesenen E-Mails
        status, messages = mail.search(None, 'UNSEEN')

        if status != "OK":
            print("Keine E-Mails gefunden.")
            return []

        email_ids = messages[0].split()
        print(f"{len(email_ids)} neue E-Mails gefunden.")

        bookings = []
        for email_id in email_ids:
            # E-Mail abrufen
            status, msg_data = mail.fetch(email_id, "(RFC822)")

            if status != "OK":
                continue

            # E-Mail parsen
            msg = email.message_from_bytes(msg_data[0][1])
            booking = parse_email(msg)
            bookings.append(booking)

            print(f"  ✓ E-Mail verarbeitet: {booking['name']} - {booking['date']}")

        mail.close()
        mail.logout()

        return bookings

    except Exception as e:
        print(f"Fehler beim Abrufen der E-Mails: {e}")
        return []


def save_bookings(bookings, filename):
    """Speichert Buchungen als JSON"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(bookings, f, ensure_ascii=False, indent=2)
    print(f"\n✓ {len(bookings)} Buchungen gespeichert in {filename}")


def main():
    print("=" * 60)
    print("Eisfavorite E-Mail Importer")
    print("=" * 60)

    # Passwort prüfen
    if not PASSWORD:
        print("\n⚠️  FEHLER: Bitte trage dein Gmail App-Passwort ein!")
        print("\nSo erstellst du ein App-Passwort:")
        print("1. Gehe zu https://myaccount.google.com/security")
        print("2. Aktiviere 2-Faktor-Authentifizierung (falls nicht aktiv)")
        print("3. Gehe zu 'App-Passwörter'")
        print("4. Erstelle ein neues App-Passwort für 'Mail'")
        print("5. Trage das Passwort in diese Datei ein (Zeile 17)\n")
        return

    # E-Mails abrufen
    bookings = fetch_emails(EMAIL, PASSWORD)

    if not bookings:
        print("\nKeine neuen Anfragen gefunden.")
        return

    # Speichern
    save_bookings(bookings, OUTPUT_FILE)

    print("\n" + "=" * 60)
    print("Import abgeschlossen!")
    print("=" * 60)
    print(f"\nÖffne jetzt die Buchungsübersicht und klicke auf")
    print("'📤 JSON importieren' um die neuen Anfragen zu laden.")


if __name__ == "__main__":
    main()
