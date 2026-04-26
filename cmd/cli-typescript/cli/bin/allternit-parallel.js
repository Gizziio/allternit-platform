#!/usr/bin/env node

// packages/cli/bin/allternit-parallel.js

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

program
  .name('allternit bg parallel')
  .description('Execute parallel agent runs with Superconductor integration')
  .argument('<goal>', 'The goal to achieve in parallel')
  .option('-b, --backend <type>', 'Execution backend (local|selfhosted|superconductor)', 'local')
  .option('--snapshot-id <id>', 'Snapshot ID to use as basis for parallel runs')
  .option('--model <models...>', 'Models to use for parallel variants (e.g., gpt-4, claude-sonnet)')
  .option('--agent-type <type>', 'Agent type to use', 'code')
  .option('--verify', 'Enable verification (tests, linting, typechecking)')
  .option('--output-dir <dir>', 'Directory to save results', './parallel-results')
  .action(executeParallelRun);

async function executeParallelRun(goal, options) {
  console.log(`🚀 Executing parallel run with goal: "${goal}"`);
  console.log(`   Backend: ${options.backend}`);
  console.log(`   Models: ${options.model || 'default'}`);
  
  // Validate backend option
  const validBackends = ['local', 'selfhosted', 'superconductor'];
  if (!validBackends.includes(options.backend)) {
    console.error(`❌ Invalid backend: ${options.backend}. Valid options: ${validBackends.join(', ')}`);
    process.exit(1);
  }
  
  // Create parallel run configuration
  const runConfig = {
    runId: `parallel-${Date.now()}`,
    goal,
    backend: options.backend,
    snapshotId: options.snapshotId,
    variants: createVariants(options),
    verificationProfile: options.verify ? createVerificationProfile() : undefined,
    createdAt: new Date().toISOString()
  };
  
  // Initialize appropriate executor based on backend
  let executor;
  switch (options.backend) {
    case 'superconductor':
      const { SuperconductorExecutor } = require('../executor-superconductor/src/superconductor.executor');
      // Load config from environment or config file
      const scConfig = {
        apiKey: process.env.SUPERCONDUCTOR_API_KEY,
        endpoint: process.env.SUPERCONDUCTOR_ENDPOINT || 'https://api.superconductor.ai',
        pollingInterval: parseInt(process.env.SUPERCONDUCTOR_POLL_INTERVAL) || 5000
      };
      
      if (!scConfig.apiKey) {
        console.error('❌ SUPERCONDUCTOR_API_KEY environment variable is required for superconductor backend');
        process.exit(1);
      }
      
      executor = new SuperconductorExecutor(scConfig);
      break;
      
    case 'selfhosted':
      // TODO: Implement SelfhostedExecutor
      console.error('❌ SelfhostedExecutor not yet implemented');
      process.exit(1);
      
    case 'local':
      const { LocalExecutor } = require('../src/local-executor');
      executor = new LocalExecutor(options);
      break;
  }
  
  try {
    console.log(`\n📈 Starting parallel execution...`);
    const result = await executor.execute(runConfig);
    
    console.log('\n✅ Parallel run completed!');
    console.log(`   Run ID: ${result.runId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Variants: ${result.results.length}`);
    console.log(`   Completed: ${result.results.filter(r => r.status === 'completed').length}`);
    console.log(`   Failed: ${result.results.filter(r => r.status === 'failed').length}`);
    
    // Save results
    const outputDir = options.outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const resultsPath = path.join(outputDir, `${runConfig.runId}-results.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    
    // Show preview URLs if available
    const previewVariants = result.results.filter(r => r.previewUrl);
    if (previewVariants.length > 0) {
      console.log('\n🌐 Preview URLs:');
      previewVariants.forEach(v => {
        console.log(`   ${v.variantId}: ${v.previewUrl}`);
      });
    }
    
  } catch (error) {
    console.error(`\n❌ Parallel run failed:`, error.message);
    process.exit(1);
  }
}

function createVariants(options) {
  // If models are specified, create variants for each model
  if (options.model && options.model.length > 0) {
    return options.model.map((model, index) => ({
      variantId: `variant-${index + 1}`,
      model,
      agentType: options.agentType || 'code',
      params: {}, // Additional parameters can be added here
      priority: index + 1
    }));
  }
  
  // Default: create a single variant
  return [{
    variantId: 'variant-1',
    model: 'gpt-4',
    agentType: options.agentType || 'code',
    params: {},
    priority: 1
  }];
}

function createVerificationProfile() {
  return {
    tests: true,
    linting: true,
    typechecking: true,
    customChecks: []
  };
}

// Parse command line arguments
program.parse();