#!/usr/bin/env node
/**
 * Allternit Browser & Canvas Demo
 * 
 * This script demonstrates the full functionality of the browser module.
 * Run with: npx tsx demo.ts
 */

import { 
  startBrowserServer, 
  stopBrowserServer,
  startCanvasHost,
  type BrowserConfig,
} from './src/index.js';

const DEMO_CONFIG: BrowserConfig = {
  enabled: true,
  controlPort: 0,
  headless: true,
  noSandbox: true,
  attachOnly: false,
  profiles: {
    default: {
      name: 'default',
      cdpPort: 9222,
      cdpUrl: 'http://127.0.0.1:9222',
    },
  },
};

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Allternit Browser & Canvas Demo                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let browserServer: any;
  let canvasHost: any;

  try {
    // ═════════════════════════════════════════════════════════════
    // STEP 1: Start Browser Control Server
    // ═════════════════════════════════════════════════════════════
    console.log('📦 Step 1: Starting Browser Control Server...');
    browserServer = await startBrowserServer({ config: DEMO_CONFIG });
    console.log(`   ✓ Browser server running on http://127.0.0.1:${browserServer.port}\n`);

    // ═════════════════════════════════════════════════════════════
    // STEP 2: Start Canvas Host Server
    // ═════════════════════════════════════════════════════════════
    console.log('🎨 Step 2: Starting Canvas Host Server...');
    canvasHost = await startCanvasHost({ port: 0, liveReload: true });
    console.log(`   ✓ Canvas host running on http://127.0.0.1:${canvasHost.port}`);
    console.log(`   ✓ Canvas root: ${canvasHost.rootDir}\n`);

    // ═════════════════════════════════════════════════════════════
    // STEP 3: Test Browser API Endpoints
    // ═════════════════════════════════════════════════════════════
    console.log('🔍 Step 3: Testing Browser API Endpoints...');
    
    // Test status endpoint
    const statusRes = await fetch(`http://127.0.0.1:${browserServer.port}/`);
    const status = await statusRes.json();
    console.log(`   ✓ GET / - Status: enabled=${status.enabled}, profile=${status.profile}`);

    // Test profiles endpoint
    const profilesRes = await fetch(`http://127.0.0.1:${browserServer.port}/profiles`);
    const profiles = await profilesRes.json();
    console.log(`   ✓ GET /profiles - Found ${profiles.profiles.length} profile(s)`);

    // Test tabs endpoint (will fail without browser started - that's OK)
    try {
      const tabsRes = await fetch(`http://127.0.0.1:${browserServer.port}/tabs`);
      console.log(`   ✓ GET /tabs - Status: ${tabsRes.status}`);
    } catch {
      console.log(`   ⚠ GET /tabs - Browser not running (expected)`);
    }
    console.log();

    // ═════════════════════════════════════════════════════════════
    // STEP 4: Test Canvas Host Endpoints
    // ═════════════════════════════════════════════════════════════
    console.log('🖼️  Step 4: Testing Canvas Host Endpoints...');
    
    const canvasRes = await fetch(`http://127.0.0.1:${canvasHost.port}/`);
    const canvasHtml = await canvasRes.text();
    console.log(`   ✓ GET / - Returns ${canvasHtml.length} bytes HTML`);
    console.log(`   ✓ Contains "Allternit Canvas": ${canvasHtml.includes('Allternit Canvas')}`);
    console.log();

    // ═════════════════════════════════════════════════════════════
    // STEP 5: Architecture Verification
    // ═════════════════════════════════════════════════════════════
    console.log('🏗️  Step 5: Architecture Verification...');
    
    // Verify all exports
    const module = await import('./src/index.js');
    const exports = Object.keys(module);
    
    console.log(`   ✓ Module exports: ${exports.length} items`);
    console.log(`   ✓ Browser server: ${typeof module.startBrowserServer === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ Canvas host: ${typeof module.startCanvasHost === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ CDP Client: ${typeof module.CDPClient === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ Tab functions: ${typeof module.getTabs === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ Screenshot: ${typeof module.captureScreenshot === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ Playwright actions: ${typeof module.clickViaPlaywright === 'function' ? 'OK' : 'FAIL'}`);
    console.log(`   ✓ A2UI hosting: ${typeof module.handleA2uiHttpRequest === 'function' ? 'OK' : 'FAIL'}`);
    console.log();

    // ═════════════════════════════════════════════════════════════
    // COMPLETION
    // ═════════════════════════════════════════════════════════════
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ DEMO COMPLETE                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Browser Server:  http://127.0.0.1:${browserServer.port}`);
    console.log(`║  Canvas Host:     http://127.0.0.1:${canvasHost.port}`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('  1. Visit the canvas host URL in your browser');
    console.log('  2. Test API endpoints with curl');
    console.log('  3. Build the A2UI bundle for full functionality\n');
    
    console.log('Press Ctrl+C to stop servers\n');
    
    // Keep running
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    if (browserServer) await stopBrowserServer();
    if (canvasHost) await canvasHost.close();
    console.log('   ✓ Servers stopped\n');
  }
}

// Run the demo
runDemo().catch(console.error);
