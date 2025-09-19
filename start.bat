@echo off
echo Starting Mental Health Tracker...
echo.

echo Starting Flask Backend...
start "Backend" cmd /k "cd backend && python app.py"

echo.
echo Backend started on http://localhost:5000
echo.
echo To start the frontend:
echo 1. Open the frontend/pages/index.html file in your browser
echo 2. Or use a local server like Live Server extension in VS Code
echo.
echo Press any key to exit...
pause > nul
