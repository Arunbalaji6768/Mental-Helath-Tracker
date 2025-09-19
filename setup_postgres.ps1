# PostgreSQL Setup Script for Mental Health Tracker
Write-Host "Setting up PostgreSQL for Mental Health Tracker..." -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "backend\.venv")) {
    Write-Host "Error: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run: cd backend && python -m venv .venv" -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& "backend\.venv\Scripts\Activate.ps1"

# Install PostgreSQL dependencies
Write-Host "Installing PostgreSQL dependencies..." -ForegroundColor Cyan
pip install psycopg2-binary

Write-Host ""
Write-Host "Running PostgreSQL setup..." -ForegroundColor Cyan
python setup_postgres.py

Write-Host ""
Write-Host "Setup complete! Now run:" -ForegroundColor Green
Write-Host "cd backend" -ForegroundColor Yellow
Write-Host "python app.py" -ForegroundColor Yellow
Read-Host "Press Enter to continue"
