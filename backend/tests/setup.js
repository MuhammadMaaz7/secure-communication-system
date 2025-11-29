// Test setup and configuration
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/e2ee-test';

const mongoose = require('mongoose');

// Track active timers for cleanup
const activeTimers = new Set();
const timerRefs = new Map(); // Map timer to its ref status

// Override setTimeout to track timers and unref them
const originalSetTimeout = global.setTimeout;
global.setTimeout = function(...args) {
  const timer = originalSetTimeout(...args);
  activeTimers.add(timer);
  // Unref timer so it doesn't keep process alive
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
    timerRefs.set(timer, true);
  }
  return timer;
};

// Override clearTimeout to untrack timers
const originalClearTimeout = global.clearTimeout;
global.clearTimeout = function(timer) {
  activeTimers.delete(timer);
  timerRefs.delete(timer);
  return originalClearTimeout(timer);
};

// Connect to test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

// Clean up after each test
afterEach(async () => {
  // Clear all active timers
  activeTimers.forEach(timer => {
    try {
      clearTimeout(timer);
    } catch (error) {
      // Ignore errors
    }
  });
  activeTimers.clear();
  
  // Clean up database collections
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      try {
        await collections[key].deleteMany({});
      } catch (error) {
        // Ignore errors if collection doesn't exist
      }
    }
  }
  
  // Give time for any pending async operations
  await new Promise(resolve => {
    const timer = originalSetTimeout(resolve, 10);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  });
});

// Disconnect after all tests
afterAll(async () => {
  // Clear all remaining timers multiple times to catch any new ones
  for (let i = 0; i < 3; i++) {
    activeTimers.forEach(timer => {
      try {
        clearTimeout(timer);
      } catch (error) {
        // Ignore errors
      }
    });
    // Wait a bit for timers to be cleared
    await new Promise(resolve => {
      const timer = originalSetTimeout(resolve, 50);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
    });
  }
  activeTimers.clear();
  timerRefs.clear();
  
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  
  // Final wait to ensure everything is closed
  await new Promise(resolve => {
    const timer = originalSetTimeout(resolve, 200);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  });
}, 10000); // 10 second timeout for cleanup

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

