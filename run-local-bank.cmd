@echo off
setlocal
cd /d "%~dp0backend"
set "SPRING_PROFILES_ACTIVE=demo,localbank"
set "FINEDGE_DEMO_ENABLED=true"
set "LOS_DEMO_OTP_ENABLED=true"

if not defined DB_URL set "DB_URL=jdbc:postgresql://localhost:5432/finedge"
if not defined DB_USERNAME set "DB_USERNAME=finedge"
if not defined DB_PASSWORD set "DB_PASSWORD=postgres"
where mvn >nul 2>nul
if errorlevel 1 (
  echo Maven not found. Install Maven 3.9+ and Java 17+ and add to PATH.
  exit /b 1
)
call mvn spring-boot:run
