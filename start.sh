#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "========================================================"
echo "  Iniciando Jira QuickGrid Web App"
echo "========================================================"

# Trap to kill background processes on exit
trap 'kill $(jobs -p)' EXIT

# Start backend
echo "[1/2] Iniciando Backend FastAPI en http://127.0.0.1:8000..."
cd "$DIR/server"
source .venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload &

# Start frontend
echo "[2/2] Iniciando Frontend React en http://localhost:5173..."
cd "$DIR/client"
npm run dev &

echo ""
echo "Aplicación lista en: http://localhost:5173"
echo "Presiona Ctrl+C para detener."
wait
