/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Relax rules for test files — they live outside src/
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: false,
        esModuleInterop: true,
        skipLibCheck: true,
      }
    }],
  },
  moduleNameMapper: {
    // allow importing from '../src/...' in tests
    '^../src/(.*)$': '<rootDir>/src/$1',
    '^@allternit/computer-use-protocol$': '<rootDir>/../../platform/packages/computer-use-protocol/src/index.ts',
    '^@allternit/replies-contract$': '<rootDir>/../../platform/packages/replies-contract/src/index.ts',
    '^@allternit/replies-reducer$': '<rootDir>/../../platform/packages/replies-reducer/src/index.ts',
  },
};
