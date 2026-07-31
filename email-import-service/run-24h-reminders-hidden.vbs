Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\email-import-service"
objShell.Run "cmd /c node send-24h-reminders.js >> reminders-24h-log.txt 2>&1", 0, False
