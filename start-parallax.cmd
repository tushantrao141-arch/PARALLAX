@echo off
setlocal
cd /d "%~dp0"
set PORT=3100
title PARALLAX local server
echo.
echo   PARALLAX is starting at http://localhost:3100
echo   Keep this window open while playing.
echo.
call npm run dev
pause
