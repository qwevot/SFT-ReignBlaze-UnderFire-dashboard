@echo off
title UnderFire - SFT ReignBlaze Launcher
color 0A

echo ================================================================
echo    UnderFire: Peatland Smoldering Detection & Telemetry System
echo ================================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not detected on your system.
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking and installing Backend dependencies...
cd /d "%~dp0backend"
if not exist "node_modules" (
    call npm install
) else (
    echo     Backend dependencies already installed.
)

echo.
echo [2/4] Checking and installing Frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    call npm install
) else (
    echo     Frontend dependencies already installed.
)

echo.
echo [3/4] Building production UI assets...
call npm run build

echo.
echo [4/4] Launching UnderFire Unified Server...
cd /d "%~dp0backend"
start "UnderFire Backend Core" cmd /k "node server.js"

:: Give the server a brief second to boot
timeout /t 2 /nobreak >nul

echo.
echo ================================================================
echo  UnderFire is running live!
echo  Opening browser at: http://localhost:5000
echo ================================================================
echo.

start http://localhost:5000
