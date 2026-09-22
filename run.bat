@echo off
title Jira QuickGrid
echo ========================================================
echo   Iniciando Jira QuickGrid Web App
echo ========================================================
echo.

REM Iniciar Backend FastAPI
echo [1/2] Levantando Backend FastAPI (Puerto 8000)...
start "Jira Backend (FastAPI)" cmd /k "cd /d %~dp0server && .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

REM Iniciar Frontend Vite
echo [2/2] Levantando Frontend Vite (Puerto 5173)...
start "Jira Frontend (Vite)" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ========================================================
echo   Aplicacion lista!
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:8000/docs
echo ========================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173
