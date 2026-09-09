$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dotnet = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
$project = Join-Path $projectRoot 'src\BigWalkTelemetry\BigWalkTelemetry.csproj'
$dist = Join-Path $projectRoot 'dist'
if (-not (Test-Path -LiteralPath $dotnet)) { throw 'Portable .NET SDK not found.' }
& $dotnet build $project --configuration Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Copy-Item -Force -LiteralPath (Join-Path $projectRoot 'src\BigWalkTelemetry\bin\Release\net6.0\BigWalkTelemetry.dll') -Destination (Join-Path $dist 'BigWalkTelemetry.dll')
Write-Host "Built $dist\BigWalkTelemetry.dll"
