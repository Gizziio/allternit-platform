#!/usr/bin/env node

/**
 * Allternit Gateway - stdio Transport Verification Script
 * 
 * Verifies the stdio transport is working correctly:
 * 1. Spawns gateway as subprocess
 * 2. Sends health check request via stdin
 * 3. Receives response via stdout
 * 4. Tests session creation
 * 
 * Usage:
 *   node scripts/verify-stdio.js
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifyStdio() {
  log('\n🔍 Allternit Gateway stdio Verification', 'blue');
  log('=' .repeat(50), 'gray');
  log('Transport: JSON-RPC 2.0 over stdin/stdout', 'gray');
  log('');

  const results = {
    passed: 0,
    failed: 0,
  };

  // Spawn gateway process
  log('Spawning gateway subprocess...', 'blue');
  const gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  const rl = createInterface({
    input: gateway.stdout,
    output: process.stdout,
    terminal: false,
  });

  let stderrOutput = '';
  gateway.stderr.on('data', (data) => {
    stderrOutput += data.toString();
    if (data.toString().includes('Ready')) {
      log('Gateway is ready', 'green');
    }
  });

  // Wait for gateway to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Helper to send request and get response
  function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const responses = [];
      const listener = (line) => {
        if (!line.trim()) return;

        try {
          const data = JSON.parse(line);
          responses.push(data);

          // For responses (with id), resolve
          if (data.id !== undefined) {
            rl.removeListener('line', listener);
            clearTimeout(timeout);
            resolve(responses);
          }
        } catch {
          // Ignore non-JSON lines
        }
      };

      rl.on('line', listener);
      gateway.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  try {
    // Test 1: Health Check
    log('\nTest 1: Health Check', 'blue');
    const healthRequest = {
      jsonrpc: '2.0',
      method: 'health/check',
      params: {},
      id: 'test_1',
    };

    const healthResponses = await sendRequest(healthRequest);
    const healthResponse = healthResponses.find(r => r.id === 'test_1');

    if (healthResponse?.result?.status === 'healthy') {
      log('  ✅ PASS: Gateway is healthy', 'green');
      results.passed++;
    } else {
      log(`  ❌ FAIL: Unexpected response: ${JSON.stringify(healthResponse)}`, 'red');
      results.failed++;
    }

    // Test 2: Discovery
    log('\nTest 2: Service Discovery', 'blue');
    const discoveryRequest = {
      jsonrpc: '2.0',
      method: 'discovery/get',
      params: {},
      id: 'test_2',
    };

    const discoveryResponses = await sendRequest(discoveryRequest);
    const discoveryResponse = discoveryResponses.find(r => r.id === 'test_2');

    if (discoveryResponse?.result?.gateway?.version) {
      log(`  ✅ PASS: Discovery returned gateway info`, 'green');
      results.passed++;
      
      const services = discoveryResponse.result.services || [];
      log(`  Services: ${services.map(s => s.name).join(', ')}`, 'gray');
    } else {
      log(`  ❌ FAIL: Unexpected response: ${JSON.stringify(discoveryResponse)}`, 'red');
      results.failed++;
    }

    // Test 3: Session Create
    log('\nTest 3: Session Creation', 'blue');
    const sessionRequest = {
      jsonrpc: '2.0',
      method: 'session/create',
      params: {
        profile_id: 'test_profile',
        capsules: ['browser', 'terminal'],
        timeout: 3600000,
      },
      id: 'test_3',
    };

    const sessionResponses = await sendRequest(sessionRequest);
    const sessionResponse = sessionResponses.find(r => r.id === 'test_3');

    if (sessionResponse?.result?.id) {
      log(`  ✅ PASS: Session created: ${sessionResponse.result.id}`, 'green');
      results.passed++;
    } else {
      log(`  ❌ FAIL: Unexpected response: ${JSON.stringify(sessionResponse)}`, 'red');
      results.failed++;
    }

    // Test 4: Invalid Method
    log('\nTest 4: Invalid Method Handling', 'blue');
    const invalidRequest = {
      jsonrpc: '2.0',
      method: 'invalid/method',
      params: {},
      id: 'test_4',
    };

    const invalidResponses = await sendRequest(invalidRequest);
    const invalidResponse = invalidResponses.find(r => r.id === 'test_4');

    if (invalidResponse?.error?.code === -32601) {
      log('  ✅ PASS: Method not found error returned', 'green');
      results.passed++;
    } else {
      log(`  ❌ FAIL: Unexpected response: ${JSON.stringify(invalidResponse)}`, 'red');
      results.failed++;
    }

    // Test 5: Session List
    log('\nTest 5: Session List', 'blue');
    const listRequest = {
      jsonrpc: '2.0',
      method: 'session/list',
      params: {},
      id: 'test_5',
    };

    const listResponses = await sendRequest(listRequest);
    const listResponse = listResponses.find(r => r.id === 'test_5');

    if (listResponse?.result?.sessions && Array.isArray(listResponse.result.sessions)) {
      log(`  ✅ PASS: Session list returned array`, 'green');
      results.passed++;
    } else {
      log(`  ❌ FAIL: Unexpected response: ${JSON.stringify(listResponse)}`, 'red');
      results.failed++;
    }

  } catch (err) {
    log(`\n  ❌ Test execution error: ${err.message}`, 'red');
    results.failed++;
  } finally {
    // Cleanup
    rl.close();
    gateway.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  log('\n' + '='.repeat(50), 'gray');
  log('Summary:', 'blue');
  log(`  ✅ Passed: ${results.passed}`, 'green');
  if (results.failed > 0) {
    log(`  ❌ Failed: ${results.failed}`, 'red');
  }
  log('');

  if (results.failed === 0) {
    log('🎉 All stdio tests passed!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Some tests failed.', 'yellow');
    process.exit(1);
  }
}

// Run verification
verifyStdio().catch(err => {
  log(`\n❌ Verification failed: ${err.message}`, 'red');
  process.exit(1);
});
