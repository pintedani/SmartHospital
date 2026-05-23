# SmartHospital - Start Script
# This script starts both the backend API and the frontend dev server

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SmartHospital - Starting Application" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Start the backend API
Write-Host "[1/2] Starting Backend API (port 5000)..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "src\SmartHospital.API\SmartHospital.API"
$backend = Start-Process -FilePath "dotnet" -ArgumentList "run", "--urls", "http://localhost:5000" -WorkingDirectory $backendPath -PassThru -NoNewWindow:$false

Start-Sleep -Seconds 3

# Start the frontend
Write-Host "[2/2] Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "src\SmartHospital.Web"
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendPath -PassThru -NoNewWindow:$false

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Application Started!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Swagger:  http://localhost:5000/swagger" -ForegroundColor White
Write-Host ""
Write-Host "  Demo Credentials:" -ForegroundColor White
Write-Host "    Admin:   admin@smarthospital.ro / Admin123!" -ForegroundColor Gray
Write-Host "    Manager: manager.municipal@smarthospital.ro / Manager123!" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop..." -ForegroundColor DarkGray

try {
    Wait-Process -Id $backend.Id
} finally {
    if (!$frontend.HasExited) { Stop-Process -Id $frontend.Id -Force }
    if (!$backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
