@echo off
title Grid Duel Server
cd /d "%~dp0"

if not exist node_modules (
  echo Installing packages, first run only...
  call npm install
)

echo Starting Grid Duel...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3001"
node server/server.js

echo.
echo Server stopped.
pause