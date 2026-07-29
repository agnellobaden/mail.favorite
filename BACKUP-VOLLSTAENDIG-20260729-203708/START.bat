@echo off
chcp 65001 >nul
cls
echo ================================================
echo 🍦 Gmail Export Tool für EisFavorite
echo ================================================
echo.

if not exist "credentials.json" (
    echo ❌ FEHLER: credentials.json nicht gefunden!
    echo.
    echo 📌 Bitte folge der Anleitung in SETUP.md um:
    echo    1. Gmail API zu aktivieren
    echo    2. credentials.json herunterzuladen
    echo.
    pause
    exit /b 1
)

echo ▶️  Starte Gmail Export Tool...
echo.

python gmail-export-tool.py

if %errorlevel% neq 0 (
    echo.
    echo ❌ FEHLER beim Ausführen!
    echo.
    echo 💡 Überprüfe:
    echo    1. Python ist installiert
    echo    2. Pakete sind installiert (INSTALL.bat)
    echo    3. credentials.json ist vorhanden
    echo.
)

echo.
pause
