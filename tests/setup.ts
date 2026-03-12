/**
 * Vitest global test setup.
 * Configures environment and mocks for all tests.
 */
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-required';
process.env.PASSWORD_HASH = '$2b$10$test-bcrypt-hash';
process.env.MAPBOX_ACCESS_TOKEN = 'pk.test-mapbox-token';
process.env.AISSTREAM_API_KEY = 'test-aisstream-api-key';

// Global test utilities
declare global {
  // Add any global test utilities here
}
