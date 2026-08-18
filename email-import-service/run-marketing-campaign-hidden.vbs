Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "C:\Users\aagne\OneDrive\Desktop\mail.eisfavorite\email-import-service"
objShell.Run "cmd /c node send-marketing-campaign.js >> marketing-campaign-log.txt 2>&1", 0, False
