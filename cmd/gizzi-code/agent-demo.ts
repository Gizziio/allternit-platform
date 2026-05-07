import { 
  AllternitAgent, 
  AllternitHarness, 
  createAllternitClient 
} from './packages/sdk/src/index.js';

/**
 * DEMO: Building a "Vercel-like" Agent with the new Allternit SDK
 */
async function main() {
  // 1. Setup the basic infrastructure
  const harness = new AllternitHarness({
    mode: 'byok',
    byok: { keys: { anthropic: process.env.ANTHROPIC_API_KEY || 'sk-...' } }
  });
  
  const client = createAllternitClient({ baseURL: 'http://localhost:4096' });

  // 2. Initialize the high-level Agent Runtime with Capabilities and Sandbox
  const agent = new AllternitAgent(harness, client, {
    environment: 'lima',              // Use the Lima Sandbox
    capabilities: ['brain', 'filesystem', 'computer-use'], // Enable specific tools
    persistencePath: './agent-runs.db' // Enable durable checkpoints
  });

  // 3. Start a stateful Run
  const run = agent.run({
    messages: [{ 
      role: 'user', 
      content: 'Look at my project history in the brain, and then use the browser to find if there are any new security advisories for our stack.' 
    }]
  });

  // 4. Handle Human-in-the-loop "Replies"
  run.on('reply_requested', async (request) => {
    console.log(`\n[ACTION REQUIRED] ${request.payload.description}`);
    
    if (request.type === 'permission') {
      console.log(`> Approving action ${request.payload.title}...`);
      await request.submit({ type: 'permission', approved: true });
    }
  });

  // 5. Subscribe to events
  run.on('text', (text) => process.stdout.write(text));
  run.on('thought', (thought) => console.log(`\n[THINKING] ${thought}`));
  run.on('tool_call', (tc) => console.log(`\n[TOOL] ${tc.name}(${JSON.stringify(tc.arguments)})`));
  run.on('status_change', (status) => console.log(`\n[STATUS] ${status}`));

  run.on('completed', (history) => {
    console.log('\n[SUCCESS] Task finished. Checkpointing complete.');
    console.log(`Run ID: ${run.id}`);
  });

  run.on('error', (err) => {
    console.error(`\n[ERROR] Run failed: ${err.message}`);
  });
}

// main();
console.log("Durable Agent Demo script updated.");
