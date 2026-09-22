# PowerShell launcher for Jira Airtable Web App
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Iniciando Jira Airtable-like Web App (Full Stack)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Start Backend in separate process
Write-Host "`n[1/2] Levantando Backend FastAPI en http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\server'; .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Frontend in separate process
Write-Host "[2/2] Levantando Frontend React + Vite en http://localhost:5173..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\client'; npm run dev"

Start-Sleep -Seconds 3
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
