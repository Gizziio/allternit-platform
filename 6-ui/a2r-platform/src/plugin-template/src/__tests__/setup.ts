/**
 * Jest Test Setup
 * 
 * This file runs before each test file.
 */

export {};

// Mock A2R Platform APIs
interface A2RGlobal {
  plugins: {
    get: jest.Mock;
    register: jest.Mock;
  };
  storage: {
    createStorage: jest.Mock;
  };
  commands: {
    registerCommand: jest.Mock;
  };
  ui: {
    createPanel: jest.Mock;
    createStatusBarItem: jest.Mock;
  };
  events: {
    on: jest.Mock;
  };
  notifications: {
    show: jest.Mock;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var A2R: A2RGlobal;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      A2R: A2RGlobal;
    }
  }
}

// @ts-ignore - Global augmentation for test mocks
global.A2R = {
  plugins: {
    // @ts-ignore - Mock function
    get: jest.fn(),
    // @ts-ignore - Mock function
    register: jest.fn(),
  },
  storage: {
    // @ts-ignore - Mock function
    createStorage: jest.fn(),
  },
  commands: {
    // @ts-ignore - Mock function
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  },
  ui: {
    // @ts-ignore - Mock function
    createPanel: jest.fn(() => ({ dispose: jest.fn() })),
    // @ts-ignore - Mock function
    createStatusBarItem: jest.fn(() => ({ dispose: jest.fn() })),
  },
  events: {
    // @ts-ignore - Mock function
    on: jest.fn(() => ({ dispose: jest.fn() })),
  },
  notifications: {
    // @ts-ignore - Mock function
    show: jest.fn(),
  },
};

// Silence console during tests unless explicitly testing
// Uncomment the lines below to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
