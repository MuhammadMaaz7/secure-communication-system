# Quick Start Guide - Running Tests

## Prerequisites

1. **MongoDB Running**
   ```bash
   # Start MongoDB (if not running)
   mongod
   # Or using Docker:
   docker run -d -p 27017:27017 mongo
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create Test Environment File**
   
   **PowerShell:**
   ```powershell
   # Create .env.test file directly
   @"
   NODE_ENV=test
   JWT_SECRET=test-jwt-secret-key-for-testing-only-change-in-production
   MONGODB_URI=mongodb://localhost:27017/e2ee-test
   PORT=5001
   "@ | Out-File -FilePath .env.test -Encoding utf8
   ```
   
   **Or manually create** `backend/.env.test` with:
   ```
   NODE_ENV=test
   JWT_SECRET=test-jwt-secret-key-for-testing-only-change-in-production
   MONGODB_URI=mongodb://localhost:27017/e2ee-test
   PORT=5001
   ```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test keyExchange.test.js
npm test replayAttack.test.js
```

### Run Tests in Watch Mode
```bash
npm test:watch
```

### Generate Coverage Report
```bash
npm test:coverage
```

Coverage report will be in `backend/coverage/` directory.

## Test Output

Tests will show:
- ✅ Passing tests
- ❌ Failing tests
- Coverage percentages
- Test execution time

## Common Issues

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Ensure MongoDB is running on port 27017

### Port Already in Use
```
Error: Port 5000 already in use
```
**Solution**: Tests use port 5001 by default in test environment

### Missing Environment Variables
```
Error: JWT_SECRET is not defined
```
**Solution**: Ensure `.env.test` file exists with required variables

## Test Database

- **Database Name**: `e2ee-test`
- **Auto-cleanup**: Database is cleaned after each test
- **Auto-drop**: Database is dropped after all tests complete

## Next Steps

1. Review test output
2. Check coverage report
3. Add more tests for uncovered code
4. Integrate into CI/CD pipeline

