@echo off
echo Starting backend server...
cd backend
start "Backend Server" cmd /k "node working-server.js"
timeout /t 5 /nobreak > nul

echo Starting frontend server...
cd frontend
start "Frontend Server" cmd /k "npm start"

echo.
echo Both servers started in separate windows!
echo.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo.
pause