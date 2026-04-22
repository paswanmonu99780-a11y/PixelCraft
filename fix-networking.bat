@echo off
echo Fixing Node.js networking issues on Windows...
echo.

echo Step 1: Adding firewall rule for Node.js...
netsh advfirewall firewall add rule name="NodeJS HTTP" dir=in action=allow protocol=TCP localport=5000 program="%ProgramFiles%\nodejs\node.exe" >nul 2>&1
netsh advfirewall firewall add rule name="NodeJS Ports" dir=in action=allow protocol=TCP localport=5000-5010 >nul 2>&1

echo Step 2: Disabling Windows Defender real-time protection temporarily...
powershell -Command "Set-MpPreference -DisableRealtimeMonitoring $true" >nul 2>&1

echo.
echo Networking fix applied! Please:
echo 1. Restart your computer
echo 2. Run the backend server again: cd backend && npm run dev
echo 3. Then start frontend: cd frontend && npm start
echo.
echo Press any key to continue...
pause >nul