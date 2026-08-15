@echo off
cd /d "%~dp0"
node match-scans.js >> match-scans-log.txt 2>&1
