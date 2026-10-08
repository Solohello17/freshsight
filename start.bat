@echo off
echo ============================================
echo   FreshSight - Starting All Services
echo ============================================
echo.

echo [1/2] Starting Backend (FastAPI) on port 8000...
start "FreshSight Backend" cmd /k "cd /d %~dp0 && python run.py"

echo [2/2] Starting Frontend (Vite) on port 5173...
start "FreshSight Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ============================================
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://127.0.0.1:5173
echo ============================================
echo.
echo Both servers are starting in separate windows.
echo Close this window when done.
pause
