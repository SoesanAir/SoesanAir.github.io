@echo off
REM Castaway environment editor — one-click launcher (Windows).
REM Starts the local static server and opens the editor in your browser.
REM Close this window (or Ctrl+C) to stop the server.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH. Install Node ^(https://nodejs.org^) and try again.
  pause
  exit /b 1
)
echo Starting the Castaway environment editor...
node tools\serve.js 8110 --open /editor.html
pause
