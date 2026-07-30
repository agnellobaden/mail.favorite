Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\email-import-service"
objShell.Run "cmd /c node import.js >> import-log.txt 2>&1", 0, False
