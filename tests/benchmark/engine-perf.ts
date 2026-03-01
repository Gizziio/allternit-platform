import { A2RRuntimeBridge } from '@a2r/runtime';
import path from 'path';

async function runBenchmark() {
  console.log('Starting Benchmark: A2R Engine Cold Start');
  
  const startInit = performance.now();
  const bridge = new A2RRuntimeBridge({
    rootDir: process.cwd(),
    storageDir: path.join(process.cwd(), '.a2r/bench-receipts'),
    enforceWih: false
  });
  const endInit = performance.now();
  console.log(`Initialization: ${(endInit - startInit).toFixed(2)}ms`);

  console.log('Starting Benchmark: Shell Execution');
  const startExec = performance.now();
  await bridge.executeTool(
    { tool: 'shell', arguments: { command: 'echo "bench"' }, context: {} },
    'bench-agent'
  );
  const endExec = performance.now();
  console.log(`Execution: ${(endExec - startExec).toFixed(2)}ms`);
}

runBenchmark().catch(console.error);
