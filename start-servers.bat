@echo off
echo Starting Image Generator servers...
echo.

echo Starting backend server...
start "Backend Server" cmd /k "cd backend && node working-server.js"

timeout /t 3 /nobreak > nul

echo Starting frontend server...
start "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo Servers starting up...
echo Frontend will be available at: http://localhost:3000
echo Backend API at: http://localhost:5000
echo.
echo Press any key to close this window (servers will keep running)...
pause > nul