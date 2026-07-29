@echo off
chcp 65001 >nul
echo ================================================
echo 🍦 Gmail Export Tool - Installation
echo ================================================
echo.

echo 📦 Installiere Python-Pakete...
echo.

pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo ❌ FEHLER: Installation fehlgeschlagen!
    echo.
    echo 💡 Mögliche Lösungen:
    echo    1. Stelle sicher, dass Python installiert ist
    echo    2. Starte die Eingabeaufforderung als Administrator
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo ✅ Installation erfolgreich!
echo ================================================
echo.
echo 📌 Nächste Schritte:
echo    1. Folge der Anleitung in SETUP.md
echo    2. Lade credentials.json herunter
echo    3. Führe 'START.bat' aus
echo.
pause
