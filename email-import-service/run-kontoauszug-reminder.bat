@echo off
cd /d "%~dp0"
node kontoauszug-reminder.js >> kontoauszug-reminder-log.txt 2>&1
