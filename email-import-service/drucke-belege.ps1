# Erzeugt die aktuelle "Alle Belege chronologisch"-PDF neu und schickt sie
# direkt an den Standarddrucker (Canon MP620 (USB)) - ohne den PDF-Viewer
# erst manuell oeffnen und auf Drucken klicken zu muessen.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Erstelle aktuelle Beleg-PDF..."
node export-belege-chronologisch.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER beim Erstellen der PDF." -ForegroundColor Red
    Read-Host "Enter zum Schliessen"
    exit 1
}

$neueste = Get-ChildItem "$PSScriptRoot\exports\*.pdf" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $neueste) {
    Write-Host "Keine PDF gefunden." -ForegroundColor Red
    Read-Host "Enter zum Schliessen"
    exit 1
}

Write-Host "Sende '$($neueste.Name)' an den Standarddrucker..."
Start-Process -FilePath $neueste.FullName -Verb Print
Write-Host "Fertig - der Druckauftrag wurde losgeschickt. Dieses Fenster schliesst sich gleich."
Start-Sleep -Seconds 5
