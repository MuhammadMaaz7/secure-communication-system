# Frontend Tests

## Setup

Frontend tests require a browser environment with IndexedDB support. We use Vitest with jsdom for testing.

## Installation

```bash
cd frontend
npm install --save-dev vitest @vitest/ui jsdom
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

- `keyStorage.test.js` - Tests for secure key storage in IndexedDB
- Additional tests can be added for:
  - Crypto utilities
  - Key exchange protocol
  - Message encryption/decryption
  - File encryption

## Test Environment

Tests run in a simulated browser environment using jsdom. IndexedDB is mocked for testing purposes.


