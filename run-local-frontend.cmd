@echo off
setlocal
cd /d "%~dp0frontend"
where npm >nul 2>nul
if errorlevel 1 (echo Node.js/npm not installed & exit /b 1)
if not exist node_modules call npm ci
call npm run dev
