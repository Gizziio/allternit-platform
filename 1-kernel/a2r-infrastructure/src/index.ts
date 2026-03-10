/**
 * A2R Infrastructure API Server
 * 
 * Main entry point for the A2R infrastructure backend service.
 * This service provides:
 * - VPS connection management
 * - Cloud provider deployments (Hetzner, DigitalOcean, AWS)
 * - Environment provisioning with Docker
 * - SSH key management
 * - Real-time events via WebSocket
 */

import { startServer } from './server';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  process.exit(1);
});

// Start the server
async function main() {
  try {
    await startServer();
  } catch (error) {
    logger.error('Failed to start application', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
}

// Run the application
main();

export { startServer } from './server';
export { createServer } from './server';
