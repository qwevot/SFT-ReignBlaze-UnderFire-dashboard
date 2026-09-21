@echo off
title UnderFire - Development Mode Launcher
color 0B

echo ================================================================
echo    UnderFire: Development Live-Reload Launcher
echo ================================================================
echo.

cd /d "%~dp0backend"
if not exist "node_modules" call npm install
start "UnderFire Backend API" cmd /k "node --watch server.js"

cd /d "%~dp0frontend"
if not exist "node_modules" call npm install
start "UnderFire Frontend Vite" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:3000
