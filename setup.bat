@echo off
setlocal enabledelayedexpansion
title Jira QuickGrid - Setup y Lanzador Todo-en-Uno

echo ========================================================
echo   Jira QuickGrid - Setup y Lanzador Todo-en-Uno
echo ========================================================
echo.

REM 1. Sincronizar repositorio con Git (git pull)
git --version >nul 2>&1
if not errorlevel 1 (
    echo [1/4] Actualizando repositorio desde GitHub (git pull origin)...
    cd /d "%~dp0"
    for /f "delims=" %%b in ('git branch --show-current 2^>nul') do (
        set "CURRENT_BRANCH=%%b"
    )
    if defined CURRENT_BRANCH (
        echo   Rama detectada: !CURRENT_BRANCH!
        git pull origin !CURRENT_BRANCH!
    ) else (
        git pull
    )
    if errorlevel 1 (
        echo   [AVISO] No se pudo sincronizar con GitHub o ya esta al dia. Continuando con instalacion local...
    )
    echo.
) else (
    echo [AVISO] Git no fue detectado en PATH. Saltando sincronizacion remota.
    echo.
)

REM 2. Verificar dependencias del sistema
echo [2/4] Verificando dependencias del sistema...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Python 3.10 o superior desde https://www.python.org/
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js 20 o superior desde https://nodejs.org/
    pause
    exit /b 1
)
echo   Python y Node.js verificados correctamente.
echo.

REM 3. Configurar Backend (Python)
echo [3/4] Configurando Backend (Python)...
cd /d "%~dp0server"
if not exist ".venv" (
    echo   Creando entorno virtual .venv...
    python -m venv .venv
)
echo   Instalando / actualizando dependencias de Python (requirements.txt)...
call .\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
echo   Backend configurado con exito.
echo.

REM 4. Configurar Frontend (React + Vite)
echo [4/4] Configurando Frontend (Node.js / React)...
cd /d "%~dp0client"
echo   Instalando dependencias de npm...
call npm install
echo   Frontend configurado con exito.
echo.

REM 5. Iniciar la aplicacion (Backend + Frontend)
echo ========================================================
echo   Iniciando Jira QuickGrid Web App...
echo ========================================================
echo.
echo   - Levantando Backend FastAPI (Puerto 8000)...
start "Jira Backend (FastAPI)" cmd /k "cd /d "%~dp0server" && .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo   - Levantando Frontend Vite (Puerto 5173)...
start "Jira Frontend (Vite)" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo ========================================================
echo   Aplicacion iniciada con exito!
echo   Frontend:    http://localhost:5173
echo   Backend API: http://127.0.0.1:8000/docs
echo ========================================================
echo.
echo Abriendo navegador en 3 segundos...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Puedes minimizar o cerrar esta ventana cuando desees.
pause
