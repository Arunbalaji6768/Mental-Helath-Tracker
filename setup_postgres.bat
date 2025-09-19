@echo off
echo Setting up PostgreSQL for Mental Health Tracker...
echo.

REM Check if virtual environment exists
if not exist "backend\.venv" (
    echo Error: Virtual environment not found!
    echo Please run: cd backend && python -m venv .venv
    pause
    exit /b 1
)

REM Activate virtual environment and install dependencies
echo Activating virtual environment...
call backend\.venv\Scripts\activate.bat

echo Installing PostgreSQL dependencies...
pip install psycopg2-binary

echo.
echo Running PostgreSQL setup...
python setup_postgres.py

echo.
echo Setup complete! Now run:
echo cd backend
echo python app.py
pause
