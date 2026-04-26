const { AllternitRuntimeBridge } = require('@allternit/runtime');
const path = require('path');

class LocalExecutor {
  constructor(config) {
    this.config = config || {};
    this.bridge = new AllternitRuntimeBridge({
      rootDir: process.cwd(),
      storageDir: path.join(process.cwd(), '.allternit/receipts'),
      enforceWih: false
    });
  }

  async execute(runConfig) {
    const { goal, variants } = runConfig;
    console.log('[LocalExecutor] Initializing Allternit Runtime...');

    const results = [];

    for (const variant of variants) {
      console.log('Running variant ' + variant.variantId);
      
      const startTime = Date.now();
      let status = 'completed';
      let output = '';
      
      try {
        const response = await this.bridge.plugins.executeTool(
          'shell', 
          { command: 'echo "Simulating agent work for goal: ' + goal + '"' },
          { agentId: 'local-cli-agent' }
        );

        if (!response.success) {
           throw new Error(response.error || 'Tool execution failed');
        }

        output = response.result || response.output;
        
      } catch (err) {
        console.error('Variant failed:', err);
        status = 'failed';
        output = err.message;
      }

      results.push({
        variantId: variant.variantId,
        status,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        output
      });
    }

    return {
      runId: runConfig.runId,
      status: results.every(r => r.status === 'completed') ? 'completed' : 'failed',
      results
    };
  }
}

module.exports = { LocalExecutor };
