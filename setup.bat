@echo off
title Instalador - Jira QuickGrid Web App
echo ========================================================
echo   Instalador Automatico - Jira QuickGrid Web App
echo ========================================================
echo.

REM 1. Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Python 3.10 o superior desde https://www.python.org/
    pause
    exit /b 1
)

REM 2. Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js 22.12 o superior desde https://nodejs.org/
    pause
    exit /b 1
)

REM 3. Configurar Backend Python
echo [1/2] Configurando Backend (Python)...
cd /d "%~dp0server"
if not exist ".venv" (
    echo Creando entorno virtual .venv...
    python -m venv .venv
)

echo Instalando dependencias del Backend...
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

REM 4. Configurar Frontend Node.js
echo.
echo [2/2] Configurando Frontend (React + Vite)...
cd /d "%~dp0client"
call npm ci

echo.
echo ========================================================
echo   Instalacion completada con exito!
echo.
echo   Para iniciar la aplicacion:
echo     Ejecuta: run.bat   (o .\start.ps1 en PowerShell)
echo ========================================================
pause
