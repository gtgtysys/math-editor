@echo off
cd /d "%~dp0"
echo Ceol Formula Studio
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while editing. Ctrl+C stops the server.
node scripts/launch.mjs
pause
