#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Instalador Automático - Jira QuickGrid Web App"
echo "========================================================"
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 no está instalado. Instálalo antes de continuar."
    exit 1
fi

# 2. Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] node no está instalado. Instálalo desde https://nodejs.org/"
    exit 1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# 3. Setup Backend
echo "[1/2] Configurando Backend (FastAPI)..."
cd "$DIR/server"
if [ ! -d ".venv" ]; then
    echo "Creando entorno virtual Python..."
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 4. Setup Frontend
echo ""
echo "[2/2] Configurando Frontend (React + Vite)..."
cd "$DIR/client"
npm ci

echo ""
echo "========================================================"
echo "  Instalación completada exitosamente!"
echo "  Para iniciar la app: ./start.sh"
echo "========================================================"
