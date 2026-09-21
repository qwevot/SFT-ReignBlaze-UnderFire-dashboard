@echo off
echo ===================================================
echo   Starting SFT ReignBlaze Telemetry System
echo ===================================================
start "SFT ReignBlaze Backend (Port 5000)" cmd /k "cd /d D:\SFT_ReignBlaze\backend && npm start"
timeout /t 2 >nul
start "SFT ReignBlaze Frontend (Port 3000)" cmd /k "cd /d D:\SFT_ReignBlaze\frontend && npm run dev"
echo Both servers launched! Open your browser at http://localhost:3000
