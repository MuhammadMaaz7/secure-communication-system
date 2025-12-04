@echo off
echo ========================================
echo  E2EE Chat Application Setup
echo ========================================
echo.

echo Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo Error installing backend dependencies!
    pause
    exit /b 1
)

echo.
echo Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo Error installing frontend dependencies!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure backend/.env file
echo 2. Configure frontend/.env file
echo 3. Start MongoDB
echo 4. Run: npm run dev (in backend folder)
echo 5. Run: npm run dev (in frontend folder)
echo.
echo Open http://localhost:5173 to use the app
echo.
pause