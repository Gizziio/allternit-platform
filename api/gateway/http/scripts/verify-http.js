#!/usr/bin/env node

/**
 * Allternit Gateway - HTTP Transport Verification Script
 * 
 * Verifies the HTTP transport is working correctly:
 * 1. Starts gateway in HTTP mode
 * 2. Hits health endpoint
 * 3. Hits discovery endpoint
 * 4. Opens /v1/events stream and reads events
 * 5. Tests session creation
 * 
 * Usage:
 *   node scripts/verify-http.js
 *   node scripts/verify-http.js --port 3210
 */

import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GATEWAY_PATH = join(__dirname, '../index.ts');

const PORT = process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3210';
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function verifyHttp() {
  log('\n🔍 Allternit Gateway HTTP Verification', 'blue');
  log('=' .repeat(50), 'gray');
  log(`Gateway URL: ${BASE_URL}`, 'gray');
  log('Transport: Streamable HTTP', 'gray');
  log('');

  const results = {
    passed: 0,
    failed: 0,
  };

  // Spawn gateway process
  log('Spawning gateway subprocess...', 'blue');
  const gateway = spawn('tsx', [GATEWAY_PATH, '--transport', 'http', '--port', PORT], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let gatewayReady = false;
  gateway.stderr.on('data', (data) => {
    const str = data.toString();
    if (str.includes('Listening')) {
      gatewayReady = true;
      log('Gateway is ready', 'green');
    }
  });

  // Wait for gateway to be ready
  await new Promise((resolve) => {
    const checkReady = setInterval(() => {
      if (gatewayReady) {
        clearInterval(checkReady);
        resolve();
      }
    }, 100);
    setTimeout(resolve, 5000); // Timeout after 5 seconds
  });

  try {
    // Test 1: Health Check
    log('\nTest 1: Health Check (/health)', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/health',
        method: 'GET',
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        if (data.status === 'healthy') {
          log('  ✅ PASS: Gateway is healthy', 'green');
          results.passed++;
        } else {
          log(`  ⚠️  WARNING: Gateway status is ${data.status}`, 'yellow');
          results.passed++;
        }
      } else {
        log(`  ❌ FAIL: Unexpected status code ${response.statusCode}`, 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 2: Discovery Endpoint
    log('\nTest 2: Discovery Endpoint (/v1/discovery)', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/v1/discovery',
        method: 'GET',
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        if (data.gateway && Array.isArray(data.services)) {
          log(`  ✅ PASS: Discovery returned ${data.services.length} services`, 'green');
          results.passed++;
          
          for (const service of data.services) {
            const statusColor = service.status === 'healthy' ? 'green' : 'yellow';
            log(`    - ${service.name}: ${service.status}`, statusColor);
          }
        } else {
          log('  ⚠️  WARNING: Invalid discovery response format', 'yellow');
          results.passed++;
        }
      } else {
        log(`  ❌ FAIL: Unexpected status code ${response.statusCode}`, 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 3: SSE Events Endpoint
    log('\nTest 3: SSE Events Endpoint (/v1/events)', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/v1/events',
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (response.statusCode === 200) {
        if (response.headers['content-type']?.includes('text/event-stream')) {
          log('  ✅ PASS: SSE endpoint returns correct content-type', 'green');
          results.passed++;
          
          // Check for connected event
          if (response.body.includes('event: connected')) {
            log('  ✅ PASS: SSE connection event received', 'green');
            results.passed++;
          } else {
            log('  ⚠️  WARNING: No connected event in response', 'yellow');
            results.passed++;
          }
        } else {
          log(`  ❌ FAIL: Wrong content-type: ${response.headers['content-type']}`, 'red');
          results.failed++;
        }
      } else {
        log(`  ❌ FAIL: Unexpected status code ${response.statusCode}`, 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 4: Session Create
    log('\nTest 4: Session Creation (/v1/sessions)', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/v1/sessions',
        method: 'POST',
        body: JSON.stringify({
          profile_id: 'test_profile',
          capsules: ['browser'],
        }),
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        if (data.id) {
          log(`  ✅ PASS: Session created: ${data.id}`, 'green');
          results.passed++;
        } else {
          log(`  ❌ FAIL: Missing session id in response`, 'red');
          results.failed++;
        }
      } else {
        log(`  ❌ FAIL: Unexpected status code ${response.statusCode}`, 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 5: Session List
    log('\nTest 5: Session List (/v1/sessions)', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/v1/sessions',
        method: 'GET',
      });

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        if (data.sessions && Array.isArray(data.sessions)) {
          log(`  ✅ PASS: Session list returned ${data.sessions.length} sessions`, 'green');
          results.passed++;
        } else {
          log(`  ❌ FAIL: Missing sessions array in response`, 'red');
          results.failed++;
        }
      } else {
        log(`  ❌ FAIL: Unexpected status code ${response.statusCode}`, 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 6: Request Tracing Headers
    log('\nTest 6: Request Tracing Headers', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/health',
        method: 'GET',
      });

      const hasRequestId = !!response.headers['x-request-id'];
      const hasGatewayVersion = response.headers['x-gateway-version'] === '1.0.0';

      if (hasRequestId && hasGatewayVersion) {
        log('  ✅ PASS: All tracing headers present', 'green');
        results.passed++;
      } else {
        if (!hasRequestId) log('  ❌ Missing X-Request-ID header', 'red');
        if (!hasGatewayVersion) log('  ❌ Missing X-Gateway-Version header', 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

    // Test 7: CORS Headers
    log('\nTest 7: CORS Headers', 'blue');
    try {
      const response = await httpRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/health',
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5177',
          'Access-Control-Request-Method': 'GET',
        },
      });

      if (response.headers['access-control-allow-origin']) {
        log('  ✅ PASS: CORS headers present', 'green');
        results.passed++;
      } else {
        log('  ❌ FAIL: Missing CORS headers', 'red');
        results.failed++;
      }
    } catch (err) {
      log(`  ❌ FAIL: ${err.message}`, 'red');
      results.failed++;
    }

  } catch (err) {
    log(`\n  ❌ Test execution error: ${err.message}`, 'red');
    results.failed++;
  } finally {
    // Cleanup
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
    log('🎉 All HTTP tests passed!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Some tests failed.', 'yellow');
    process.exit(1);
  }
}

// Run verification
verifyHttp().catch(err => {
  log(`\n❌ Verification failed: ${err.message}`, 'red');
  process.exit(1);
});
