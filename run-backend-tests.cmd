@echo off
set JAVA_HOME=C:\tools\jdk-17.0.12+7
set PATH=C:\tools\jdk-17.0.12+7\bin;C:\tools\apache-maven-3.9.9\bin;%PATH%
cd /d "%~dp0backend"
C:\tools\apache-maven-3.9.9\bin\mvn.cmd -q test
echo EXIT:%ERRORLEVEL%
