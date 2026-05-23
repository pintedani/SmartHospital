#!/bin/bash
# SmartHospital - Start Script

echo "============================================"
echo "  SmartHospital - Starting Application"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo "[1/2] Starting Backend API (port 5000)..."
cd "$SCRIPT_DIR/src/SmartHospital.API/SmartHospital.API"
dotnet run --urls "http://localhost:5000" &
BACKEND_PID=$!

sleep 3

# Start frontend
echo "[2/2] Starting Frontend (port 5173)..."
cd "$SCRIPT_DIR/src/SmartHospital.Web"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  Application Started!"
echo "============================================"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:5000"
echo "  Swagger:  http://localhost:5000/swagger"
echo ""
echo "  Demo Credentials:"
echo "    Admin:   admin@smarthospital.ro / Admin123!"
echo "    Manager: manager.municipal@smarthospital.ro / Manager123!"
echo ""
echo "Press Ctrl+C to stop..."

cleanup() {
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM
wait
