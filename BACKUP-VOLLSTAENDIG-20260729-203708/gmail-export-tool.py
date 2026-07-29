#!/usr/bin/env python3
"""
Gmail Export Tool für EisFavorite Buchungsverwaltung
Extrahiert Buchungsanfragen aus Gmail und exportiert sie als JSON
"""

import os
import json
import re
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import base64

# Gmail API Scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    """Authentifizierung und Gmail Service erstellen"""
    creds = None

    # Token aus vorheriger Sitzung laden
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)

    # Wenn keine gültigen Credentials, neu authentifizieren
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("❌ FEHLER: credentials.json nicht gefunden!")
                print("📌 Bitte folge der Anleitung in SETUP.md")
                return None
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        # Credentials für nächstes Mal speichern
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def extract_booking_data(message_body, subject, from_email, date):
    """Extrahiert Buchungsdaten aus E-Mail-Text"""

    # Basis-Daten
    booking = {
        '_email_subject': subject,
        '_email_from': from_email,
        '_email_date': date,
        'status': 'Neu',
        'name': '',
        'email': '',
        'phone': '',
        'company': '',
        'date': '',
        'time': '',
        'timeEnd': '',
        'guests': '',
        'kugelPerGuest': '2',  # Standard
        'street': '',
        'plz': '',
        'city': '',
        'distance': '',
        'location': '',
        'wunschsorten': '',
        'notizen': message_body[:500],  # Erste 500 Zeichen als Notiz
        'eigeneNotizen': ''
    }

    # E-Mail-Adresse aus Absender
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_email)
    if email_match:
        booking['email'] = email_match.group(0)

    # Name extrahieren (vor der E-Mail-Adresse)
    name_match = re.search(r'(.+?)\s*<', from_email)
    if name_match:
        booking['name'] = name_match.group(1).strip()

    # Telefonnummer suchen
    phone_patterns = [
        r'(?:Tel|Telefon|Phone|Handy)[\s:]*([0-9\s\-\+\(\)\/]+)',
        r'(?:^|\s)(\+?49\s*\(?0?\)?[\s\-]?\d{2,4}[\s\-]?\d{3,})',
        r'(?:^|\s)(0\d{2,5}[\s\-]?\d{3,})'
    ]
    for pattern in phone_patterns:
        phone_match = re.search(pattern, message_body, re.IGNORECASE)
        if phone_match:
            booking['phone'] = phone_match.group(1).strip()
            break

    # Datum suchen (verschiedene Formate)
    date_patterns = [
        r'(\d{1,2})\.(\d{1,2})\.(\d{4})',  # 15.08.2026
        r'(\d{1,2})\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})',
        r'(\d{4})-(\d{2})-(\d{2})'  # 2026-08-15
    ]
    for pattern in date_patterns:
        date_match = re.search(pattern, message_body)
        if date_match:
            if '.' in pattern:
                day, month, year = date_match.groups()
                booking['date'] = f"{day.zfill(2)}.{month.zfill(2)}.{year}"
            break

    # Uhrzeit suchen
    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(?:Uhr)?', message_body)
    if time_match:
        hour, minute = time_match.groups()
        booking['time'] = f"{hour.zfill(2)}:{minute}"

    # Gästeanzahl suchen
    guests_patterns = [
        r'(\d+)\s*(?:Gäste|Personen|Leute)',
        r'(?:für|ca\.?)\s*(\d+)\s*(?:Gäste|Personen)'
    ]
    for pattern in guests_patterns:
        guests_match = re.search(pattern, message_body, re.IGNORECASE)
        if guests_match:
            booking['guests'] = guests_match.group(1)
            break

    # Adresse suchen
    street_match = re.search(r'([A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|allee))\s*(\d+[a-z]?)', message_body, re.IGNORECASE)
    if street_match:
        booking['street'] = f"{street_match.group(1)} {street_match.group(2)}"

    # PLZ und Stadt suchen
    plz_match = re.search(r'(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)?)', message_body)
    if plz_match:
        booking['plz'] = plz_match.group(1)
        booking['city'] = plz_match.group(2)

    # Firma/Company suchen
    company_keywords = ['GmbH', 'AG', 'UG', 'KG', 'OHG', 'e.V.', 'Verein', 'Club']
    for keyword in company_keywords:
        if keyword in message_body:
            company_match = re.search(rf'([A-ZÄÖÜ][A-Za-zäöüß\s&]+{keyword})', message_body)
            if company_match:
                booking['company'] = company_match.group(1).strip()
                break

    # Veranstaltungsort suchen
    location_patterns = [
        r'(?:Veranstaltungsort|Ort|Location)[\s:]+(.+?)(?:\n|$)',
        r'(?:in|im|am)\s+([A-ZÄÖÜ][a-zäöüß\s]+(?:Saal|Halle|Garten|Park|Hotel))',
    ]
    for pattern in location_patterns:
        location_match = re.search(pattern, message_body, re.IGNORECASE)
        if location_match:
            booking['location'] = location_match.group(1).strip()
            break

    # Eissorten suchen
    ice_flavors = ['Vanille', 'Schokolade', 'Erdbeere', 'Pistazie', 'Stracciatella',
                   'Banane', 'Haselnuss', 'Kokos', 'Mango', 'Zitrone']
    found_flavors = []
    for flavor in ice_flavors:
        if re.search(rf'\b{flavor}\b', message_body, re.IGNORECASE):
            found_flavors.append(flavor)
    if found_flavors:
        booking['wunschsorten'] = ', '.join(found_flavors[:3])  # Max 3 Sorten

    return booking

def get_message_body(message):
    """Extrahiert den Text-Body aus einer Gmail-Nachricht"""
    try:
        if 'parts' in message['payload']:
            parts = message['payload']['parts']
            for part in parts:
                if part['mimeType'] == 'text/plain':
                    data = part['body'].get('data', '')
                    if data:
                        return base64.urlsafe_b64decode(data).decode('utf-8')
        else:
            data = message['payload']['body'].get('data', '')
            if data:
                return base64.urlsafe_b64decode(data).decode('utf-8')
    except Exception as e:
        print(f"⚠️  Fehler beim Extrahieren des E-Mail-Texts: {e}")
    return ""

def fetch_emails(service, query='', max_results=50):
    """Holt E-Mails aus Gmail"""

    print(f"📧 Suche nach E-Mails mit Query: '{query}'")
    print(f"📊 Maximale Anzahl: {max_results}\n")

    try:
        # E-Mails suchen
        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=max_results
        ).execute()

        messages = results.get('messages', [])

        if not messages:
            print("❌ Keine E-Mails gefunden!")
            return []

        print(f"✅ {len(messages)} E-Mails gefunden!\n")

        bookings = []

        for i, message in enumerate(messages, 1):
            msg_id = message['id']

            # Vollständige Nachricht abrufen
            msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()

            # Header-Daten extrahieren
            headers = msg['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'Kein Betreff')
            from_email = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unbekannt')
            date_str = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')

            print(f"[{i}/{len(messages)}] 📩 {subject[:50]}...")

            # Nachrichtentext extrahieren
            body = get_message_body(msg)

            # Buchungsdaten extrahieren
            booking = extract_booking_data(body, subject, from_email, date_str)
            bookings.append(booking)

        return bookings

    except Exception as e:
        print(f"❌ FEHLER beim Abrufen der E-Mails: {e}")
        return []

def export_to_json(bookings, filename='buchungen-export.json'):
    """Exportiert Buchungen als JSON-Datei"""

    if not bookings:
        print("⚠️  Keine Buchungen zum Exportieren vorhanden!")
        return

    # Zeitstempel für Dateinamen
    timestamp = datetime.now().strftime('%Y-%m-%d-%H%M%S')
    filename = f'buchungen-export-{timestamp}.json'

    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(bookings, f, ensure_ascii=False, indent=2)

        print(f"\n✅ {len(bookings)} Buchungen erfolgreich exportiert!")
        print(f"📄 Datei: {filename}")
        print(f"\n📌 Nächster Schritt:")
        print(f"   1. Öffne https://maileisfavorite.vercel.app")
        print(f"   2. Klicke auf '📧 E-Mails prüfen'")
        print(f"   3. Wähle die Datei '{filename}' aus")

    except Exception as e:
        print(f"❌ FEHLER beim Exportieren: {e}")

def main():
    """Hauptfunktion"""

    print("=" * 60)
    print("🍦 Gmail Export Tool für EisFavorite Buchungsverwaltung")
    print("=" * 60)
    print()

    # Gmail Service erstellen
    print("🔐 Verbinde mit Gmail...")
    service = get_gmail_service()

    if not service:
        return

    print("✅ Erfolgreich verbunden!\n")

    # Benutzer nach Suchkriterien fragen
    print("📋 Suchoptionen:")
    print("1. Alle E-Mails der letzten 30 Tage")
    print("2. Nur ungelesene E-Mails")
    print("3. E-Mails mit bestimmtem Stichwort")
    print("4. Benutzerdefinierte Suche")
    print()

    choice = input("Wähle eine Option (1-4): ").strip()

    query = ''
    if choice == '1':
        query = 'newer_than:30d'
    elif choice == '2':
        query = 'is:unread'
    elif choice == '3':
        keyword = input("Stichwort eingeben (z.B. 'Buchung', 'Anfrage'): ").strip()
        query = f'subject:{keyword}'
    elif choice == '4':
        query = input("Gmail-Suchquery eingeben: ").strip()

    # Maximale Anzahl
    try:
        max_results = int(input("Maximale Anzahl E-Mails (Standard: 50): ").strip() or "50")
    except ValueError:
        max_results = 50

    print()

    # E-Mails abrufen
    bookings = fetch_emails(service, query=query, max_results=max_results)

    # Als JSON exportieren
    if bookings:
        export_to_json(bookings)

    print("\n" + "=" * 60)
    print("✨ Fertig!")
    print("=" * 60)

if __name__ == '__main__':
    main()
