$ProgressPreference = 'SilentlyContinue'
Set-Location (Join-Path $PSScriptRoot 'backend')
$env:JAVA_HOME = 'C:\tools\jdk-17.0.12+7'
$env:PATH = 'C:\tools\jdk-17.0.12+7\bin;C:\tools\apache-maven-3.9.9\bin;' + $env:PATH
& 'C:\tools\apache-maven-3.9.9\bin\mvn.cmd' test
Write-Output "EXIT:$LASTEXITCODE"
