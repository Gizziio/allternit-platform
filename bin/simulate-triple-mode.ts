// Mocking the interaction flow
import { AllternitRuntimeBridge } from '../3-adapters/allternit-runtime/src/runtime-bridge.js';

async function simulate() {
  const bridge = new AllternitRuntimeBridge();
  let context: any = { sessionId: 'sess-123', history: [] };

  console.log('--- Case 1: Standard Mode ---');
  await bridge.processCommand('list files in src', context);
  console.log('Context Mode:', context.mode || 'standard');

  console.log('\n--- Case 2: Vision Mode via a:// ---');
  await bridge.processCommand('a://browser open https://google.com', context);
  console.log('Context Mode:', context.mode);

  console.log('\n--- Case 3: Network Mode ---');
  await bridge.processCommand('run test with capture:network', context);
  console.log('Context Mode:', context.mode);
}

simulate();
