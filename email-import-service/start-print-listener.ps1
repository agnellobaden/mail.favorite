# Startet print-listener.js und laesst das Fenster offen, damit man sieht,
# ob Druckauftraege vom Handy ankommen. Muss laufen, damit "An PC-Drucker
# senden" in kassenbuch.html tatsaechlich etwas ausdruckt.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node print-listener.js
Read-Host "Druck-Empfaenger beendet. Enter zum Schliessen"
