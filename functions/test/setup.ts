// Test setup file
// This runs before all tests

// Set test environment variables
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Increase timeout for integration tests
jest.setTimeout(30000);
