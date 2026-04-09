#!/usr/bin/env node
/**
 * Standalone Cowork Controller Test
 * Starts just the Cowork mode without full Electron
 */

const path = require('path');

// Mock electron app
const mockApp = {
  getVersion: () => '0.1.0',
  getPath: () => '/tmp',
  on: () => {},
  isPackaged: false
};

// Mock electron module before requiring cowork-controller
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: { app: mockApp }
};

// Now require the cowork controller
const { startCoworkMode, stopCoworkMode, getCoworkController } = require('./dist/main/cowork-controller.js');

async function main() {
  console.log('======================================');
  console.log('Standalone Cowork Controller Test');
  console.log('======================================\n');
  
  try {
    console.log('Starting Cowork controller...');
    await startCoworkMode();
    console.log('✓ Cowork controller started\n');
    
    const controller = getCoworkController();
    console.log('Controller state:', controller.getState());
    console.log('Port: 3010\n');
    
    console.log('Press Ctrl+C to stop\n');
    
    // Keep running
    setInterval(() => {
      const state = controller.getState();
      if (state !== 'idle') {
        console.log(`[${new Date().toISOString()}] State: ${state}`);
      }
    }, 5000);
    
  } catch (err) {
    console.error('Failed to start:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nStopping...');
  stopCoworkMode();
  process.exit(0);
});

main();
