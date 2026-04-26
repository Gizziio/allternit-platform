/**
 * E2E Test: Thin Client ↔ Allternit Extension
 * 
 * This test verifies the full flow:
 * 1. Thin Client starts WebSocket server on port 3000
 * 2. Extension (simulated) connects to ws://localhost:3000/ws/extension
 * 3. Thin Client sends browser automation commands
 * 4. Extension executes commands and returns results
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// ============================================================================
// Configuration
// ============================================================================

const WS_PORT = 3000;
const WS_PATH = '/ws/extension';
const TEST_TIMEOUT = 30000;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(step: string, message: string, isError = false) {
  const color = isError ? colors.red : colors.green;
  console.log(`${color}[${step}]${colors.reset} ${message}`);
}

function info(message: string) {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
}

// ============================================================================
// Test Results
// ============================================================================

const testResults = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; passed: boolean; error?: string }>,
};

function recordTest(name: string, passed: boolean, error?: string) {
  testResults.tests.push({ name, passed, error });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// ============================================================================
// Mock Extension (Simulates the Allternit Chrome Extension)
// ============================================================================

class MockExtension {
  private ws: WebSocket | null = null;
  private connected = false;
  private receivedMessages: any[] = [];
  private messageHandlers: Map<string, (msg: any) => void> = new Map();

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${WS_PORT}${WS_PATH}`;
      info(`Extension connecting to ${url}...`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.connected = true;
        log('EXT', '✅ Connected to Thin Client');
        resolve(true);
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.receivedMessages.push(msg);
          log('EXT', `📨 Received: ${msg.type} (id: ${msg.id})`);
          
          // Handle the message
          this.handleMessage(msg);
        } catch (e) {
          log('EXT', `❌ Failed to parse message: ${e}`, true);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        log('EXT', '🔌 Disconnected');
      });

      this.ws.on('error', (err) => {
        log('EXT', `❌ Connection error: ${err.message}`, true);
        reject(err);
      });

      // Timeout
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  private handleMessage(msg: any): void {
    // Respond to pings
    if (msg.type === 'ping') {
      this.send({
        id: `pong-${Date.now()}`,
        type: 'pong',
        timestamp: Date.now(),
      });
      return;
    }

    // Handle execute commands
    if (msg.type === 'execute') {
      const action = msg.payload;
      log('EXT', `🎬 Executing action: ${action?.type || 'unknown'}`);

      // Simulate action execution
      setTimeout(() => {
        this.send({
          id: msg.id,
          type: 'action:complete',
          payload: {
            action: action?.type,
            tabId: action?.tabId || 1,
            result: {
              success: true,
              url: 'https://example.com',
              title: 'Example Domain',
            },
          },
          timestamp: Date.now(),
        });
      }, 100);
      return;
    }

    // Handle getTabs
    if (msg.type === 'getTabs') {
      this.send({
        id: msg.id,
        type: 'tabs',
        payload: [
          { id: 1, url: 'https://example.com', title: 'Example Domain', active: true },
          { id: 2, url: 'https://google.com', title: 'Google', active: false },
        ],
        timestamp: Date.now(),
      });
      return;
    }

    // Notify registered handlers
    const handler = this.messageHandlers.get(msg.type);
    if (handler) {
      handler(msg);
    }
  }

  send(msg: Omit<any, 'timestamp'>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...msg, timestamp: Date.now() }));
    }
  }

  disconnect(): void {
    this.ws?.close();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get messageCount(): number {
    return this.receivedMessages.length;
  }
}

// ============================================================================
// Thin Client Bridge (Uses the actual implementation)
// ============================================================================

// Import the actual browserAgentBridge
import { browserAgentBridge } from './surfaces/thin-client/src/main/computer-use/browser-agent-bridge.js';

// ============================================================================
// Test Cases
// ============================================================================

async function testConnection(): Promise<void> {
  info('=== Test 1: WebSocket Connection ===');
  
  try {
    // Start the bridge
    browserAgentBridge.start();
    
    // Wait for server to start
    await new Promise(r => setTimeout(r, 500));
    
    // Connect mock extension
    const extension = new MockExtension();
    await extension.connect();
    
    // Verify connection
    if (browserAgentBridge.isConnected && extension.isConnected) {
      log('TEST', '✅ Connection established in both directions');
      recordTest('WebSocket Connection', true);
    } else {
      throw new Error('Connection not established');
    }

    // Cleanup
    extension.disconnect();
    browserAgentBridge.stop();
    
  } catch (err: any) {
    log('TEST', `❌ Connection test failed: ${err.message}`, true);
    recordTest('WebSocket Connection', false, err.message);
    throw err;
  }
}

async function testExecuteAction(): Promise<void> {
  info('=== Test 2: Execute Browser Action ===');
  
  try {
    // Start the bridge
    browserAgentBridge.start();
    await new Promise(r => setTimeout(r, 500));
    
    // Connect mock extension
    const extension = new MockExtension();
    await extension.connect();
    await new Promise(r => setTimeout(r, 500));
    
    // Execute an action through the bridge
    const action = {
      type: 'BROWSER.NAV' as const,
      tabId: 1,
      params: { url: 'https://example.com' },
    };
    
    log('BRIDGE', `🚀 Sending action: ${action.type}`);
    const result = await browserAgentBridge.executeAction(action);
    
    log('TEST', `✅ Action result: ${JSON.stringify(result)}`);
    recordTest('Execute Browser Action', true);

    // Cleanup
    extension.disconnect();
    browserAgentBridge.stop();
    
  } catch (err: any) {
    log('TEST', `❌ Execute action test failed: ${err.message}`, true);
    recordTest('Execute Browser Action', false, err.message);
    throw err;
  }
}

async function testGetTabs(): Promise<void> {
  info('=== Test 3: Get Tabs ===');
  
  try {
    // Start the bridge
    browserAgentBridge.start();
    await new Promise(r => setTimeout(r, 500));
    
    // Connect mock extension
    const extension = new MockExtension();
    await extension.connect();
    await new Promise(r => setTimeout(r, 500));
    
    // Get tabs through the bridge
    log('BRIDGE', '🚀 Getting tabs...');
    const tabs = await browserAgentBridge.getTabs();
    
    log('TEST', `✅ Got ${tabs.length} tabs`);
    if (tabs.length === 2 && tabs[0].url === 'https://example.com') {
      recordTest('Get Tabs', true);
    } else {
      throw new Error('Unexpected tabs data');
    }

    // Cleanup
    extension.disconnect();
    browserAgentBridge.stop();
    
  } catch (err: any) {
    log('TEST', `❌ Get tabs test failed: ${err.message}`, true);
    recordTest('Get Tabs', false, err.message);
    throw err;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests(): Promise<void> {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  E2E Test: Thin Client ↔ Allternit Extension');
  console.log('='.repeat(60));
  console.log('\n');

  const startTime = Date.now();

  try {
    await testConnection();
  } catch (e) {
    // Continue to other tests
  }

  try {
    await testExecuteAction();
  } catch (e) {
    // Continue
  }

  try {
    await testGetTabs();
  } catch (e) {
    // Continue
  }

  const duration = Date.now() - startTime;

  // Print summary
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  Test Summary');
  console.log('='.repeat(60));
  
  for (const test of testResults.tests) {
    const icon = test.passed ? '✅' : '❌';
    const color = test.passed ? colors.green : colors.red;
    console.log(`${color}${icon}${colors.reset} ${test.name}`);
    if (test.error) {
      console.log(`   ${colors.red}Error: ${test.error}${colors.reset}`);
    }
  }

  console.log('-'.repeat(60));
  console.log(`Total: ${testResults.tests.length} tests`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`Duration: ${duration}ms`);
  console.log('='.repeat(60));

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
