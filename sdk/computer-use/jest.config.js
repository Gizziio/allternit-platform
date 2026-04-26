/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        // Relax rules for test files — they live outside src/
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: false,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    },
  },
  moduleNameMapper: {
    // allow importing from '../src/...' in tests
    '^../src/(.*)$': '<rootDir>/src/$1',
  },
};
