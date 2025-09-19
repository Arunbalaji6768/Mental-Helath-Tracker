# Backend Setup and Troubleshooting Guide

## Quick Start

1. **Start the Backend Server:**
   - Double-click `start_backend.bat` in the main project folder
   - OR open Command Prompt/PowerShell and run:
     ```bash
     cd backend
     python app.py
     ```

2. **Test the Connection:**
   - Open `frontend/create-user.html` in your browser
   - Click the "Test Backend Connection" button
   - If successful, you'll see "✅ Backend is running!"

## Troubleshooting

### Backend Won't Start

**Problem:** Backend server doesn't start or crashes immediately.

**Solutions:**
1. **Check Python Installation:**
   ```bash
   python --version
   ```
   Should show Python 3.8 or higher.

2. **Install Dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Check Database Connection:**
   - Ensure PostgreSQL is running
   - Check if database "MHT" exists
   - Verify credentials in `backend/config.py`

4. **Check Port Availability:**
   ```bash
   netstat -an | findstr :5000
   ```
   If port 5000 is in use, change the port in `backend/app.py`

### Frontend Can't Connect to Backend

**Problem:** Frontend shows "Backend server is not running" error.

**Solutions:**
1. **Start Backend First:**
   - Always start the backend before using the frontend
   - Use `start_backend.bat` or run `python app.py` in the backend folder

2. **Check Backend Status:**
   - Look for "Running on http://127.0.0.1:5000" in the console
   - Use the "Test Backend Connection" button in the frontend

3. **Firewall/Antivirus:**
   - Temporarily disable Windows Firewall
   - Add Python to antivirus exceptions
   - Check if any security software is blocking the connection

4. **Port Issues:**
   - Try changing the port in both `backend/app.py` and frontend files
   - Use ports like 8000, 3000, or 8080

### Database Issues

**Problem:** Database connection errors.

**Solutions:**
1. **Start PostgreSQL:**
   - Ensure PostgreSQL service is running
   - Check if it's listening on port 5432

2. **Create Database:**
   ```sql
   CREATE DATABASE MHT;
   ```

3. **Check Credentials:**
   - Verify username/password in `backend/config.py`
   - Default: postgres/Arun6768

## Manual Testing

### Test Backend Directly
```bash
# Test health endpoint
curl http://localhost:5000/health

# Test signup endpoint
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"TestPass123"}'
```

### Test Database Connection
```bash
python test_db_connection.py
```

## Common Error Messages

- **"Connection refused"**: Backend not running
- **"Failed to fetch"**: Network/firewall issue
- **"Database connection failed"**: PostgreSQL not running or wrong credentials
- **"Port already in use"**: Another service using port 5000

## Getting Help

1. Check the console output when starting the backend
2. Use the "Test Backend Connection" button in the frontend
3. Verify all dependencies are installed
4. Ensure PostgreSQL is running and accessible
