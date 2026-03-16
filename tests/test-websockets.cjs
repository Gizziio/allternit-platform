#!/usr/bin/env node
/**
 * WebSocket Integration Test
 * Tests connections between all components
 */

const WebSocket = require('ws');
const http = require('http');

const TESTS = {
  cloud: { port: 8080, path: '/ws/extension', name: 'Cloud Backend' },
  desktop: { port: 3010, path: '/', name: 'Desktop Cowork' },
};

async function testWebSocket(config) {
  return new Promise((resolve, reject) => {
    const url = `ws://localhost:${config.port}${config.path}`;
    console.log(`\nTesting ${config.name}...`);
    console.log(`  URL: ${url}`);
    
    const ws = new WebSocket(url);
    let resolved = false;
    
    ws.on('open', () => {
      console.log(`  ✓ Connected`);
      
      // Send ping
      ws.send(JSON.stringify({
        id: `test-${Date.now()}`,
        type: 'ping',
        timestamp: Date.now()
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`  ✓ Received: ${msg.type}`);
        
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({ success: true, type: msg.type });
        }
      } catch (e) {
        console.log(`  ✗ Invalid message: ${e.message}`);
      }
    });
    
    ws.on('error', (err) => {
      console.log(`  ✗ Error: ${err.message}`);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    
    ws.on('close', () => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Connection closed' });
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 5000);
  });
}

async function testHttpHealth(port, name) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${name} HTTP health...`);
    
    http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`  ✓ Health: ${json.status}`);
          console.log(`  ✓ Connections: ${json.connections}`);
          resolve({ success: true, data: json });
        } catch (e) {
          console.log(`  ✗ Invalid response: ${e.message}`);
          resolve({ success: false, error: e.message });
        }
      });
    }).on('error', (err) => {
      console.log(`  ✗ Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
}

async function runTests() {
  console.log('======================================');
  console.log('WebSocket Integration Tests');
  console.log('======================================');
  
  const results = {};
  
  // Test Cloud Backend HTTP
  results.cloudHealth = await testHttpHealth(8080, 'Cloud Backend');
  
  // Test Cloud Backend WebSocket
  try {
    results.cloud = await testWebSocket(TESTS.cloud);
  } catch (err) {
    results.cloud = { success: false, error: err.message };
  }
  
  // Test Desktop Cowork WebSocket
  try {
    results.desktop = await testWebSocket(TESTS.desktop);
  } catch (err) {
    results.desktop = { success: false, error: err.message };
  };
  
  // Summary
  console.log('\n======================================');
  console.log('Test Summary');
  console.log('======================================');
  
  let allPassed = true;
  
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${name}`);
    if (!result.success) {
      console.log(`       Error: ${result.error}`);
      allPassed = false;
    }
  }
  
  console.log('======================================');
  
  if (allPassed) {
    console.log('All tests passed! ✓');
    process.exit(0);
  } else {
    console.log('Some tests failed. Check the output above.');
    process.exit(1);
  }
}

runTests();
