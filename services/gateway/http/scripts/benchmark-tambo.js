#!/usr/bin/env node

/**
 * Tambo Performance Benchmark
 * 
 * Benchmarks all Tambo endpoints to measure performance characteristics.
 */

import http from 'http';

const GATEWAY_URL = process.env.Allternit_GATEWAY_URL || 'http://127.0.0.1:3210';

// Colors for output
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

// =============================================================================
// HTTP Helpers
// =============================================================================

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, GATEWAY_URL);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// =============================================================================
// Test Data
// =============================================================================

function createTestSpec(componentCount = 1) {
  const components = Array.from({ length: componentCount }, (_, i) => ({
    component_id: `btn-${i}`,
    component_type: 'button',
    properties: { label: `Button ${i}` },
    children: [],
    bindings: [],
  }));

  return {
    spec_id: `benchmark-${Date.now()}`,
    title: 'Benchmark UI',
    description: 'Performance test',
    components,
    layout: { layout_type: 'flex', constraints: {}, regions: [] },
    style: {
      theme: 'default',
      colors: {},
      typography: { font_family: 'Arial', font_sizes: {}, line_heights: {} },
      spacing: { scale: [4, 8, 16, 32], unit: 'px' },
    },
    interactions: [],
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// Benchmark Functions
// =============================================================================

async function benchmark(name, fn, iterations = 10) {
  const times = [];
  let errors = 0;
  
  log(`\n${name}`, 'blue');
  log(`  Iterations: ${iterations}`, 'gray');
  
  // Warmup
  for (let i = 0; i < 3; i++) {
    try { await fn(); } catch (e) { /* ignore */ }
  }
  
  // Benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await fn();
      const duration = performance.now() - start;
      times.push(duration);
    } catch (error) {
      errors++;
    }
  }
  
  if (errors > 0) {
    log(`  Errors: ${errors}/${iterations}`, 'red');
  }
  
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const sorted = times.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    log(`  Average: ${avg.toFixed(2)}ms`, 'green');
    log(`  Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`, 'gray');
    log(`  p50: ${p50.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms | p99: ${p99.toFixed(2)}ms`, 'gray');
    log(`  Throughput: ${(1000 / avg).toFixed(1)} req/sec`, 'yellow');
  }
  
  return { avg: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0, errors };
}

// =============================================================================
// Benchmark Suites
// =============================================================================

async function runBenchmarks() {
  log('\n' + '='.repeat(60), 'gray');
  log('Tambo Performance Benchmark', 'blue');
  log(`Gateway: ${GATEWAY_URL}`, 'gray');
  log('='.repeat(60), 'gray');
  
  const results = {};
  
  // -------------------------------------------------------------------------
  // UI Generation Benchmarks
  // -------------------------------------------------------------------------
  
  log('\n' + '-'.repeat(60), 'gray');
  log('UI Generation', 'blue');
  log('-'.repeat(60), 'gray');
  
  // Small spec (1 component)
  results.generate_1 = await benchmark(
    'POST /generate (1 component)',
    () => httpPost('/v1/tambo/generate', {
      spec: createTestSpec(1),
      ui_type: 'react',
    }),
    10
  );
  
  // Medium spec (5 components)
  results.generate_5 = await benchmark(
    'POST /generate (5 components)',
    () => httpPost('/v1/tambo/generate', {
      spec: createTestSpec(5),
      ui_type: 'react',
    }),
    10
  );
  
  // Large spec (20 components)
  results.generate_20 = await benchmark(
    'POST /generate (20 components)',
    () => httpPost('/v1/tambo/generate', {
      spec: createTestSpec(20),
      ui_type: 'react',
    }),
    5
  );
  
  // Validated generation
  results.generate_validated = await benchmark(
    'POST /generate/validated (5 components)',
    () => httpPost('/v1/tambo/generate/validated', {
      spec: createTestSpec(5),
      ui_type: 'react',
    }),
    10
  );
  
  // Reproducible generation
  results.generate_reproducible = await benchmark(
    'POST /generate/reproducible (5 components)',
    () => httpPost('/v1/tambo/generate/reproducible', {
      spec: createTestSpec(5),
      ui_type: 'react',
      seed: 12345,
    }),
    10
  );
  
  // -------------------------------------------------------------------------
  // Hash Engine Benchmarks
  // -------------------------------------------------------------------------
  
  log('\n' + '-'.repeat(60), 'gray');
  log('Hash Engine', 'blue');
  log('-'.repeat(60), 'gray');
  
  // Small content
  results.hash_small = await benchmark(
    'POST /hash (100 bytes)',
    () => httpPost('/v1/tambo/hash', { content: 'x'.repeat(100) }),
    50
  );
  
  // Medium content
  results.hash_medium = await benchmark(
    'POST /hash (10KB)',
    () => httpPost('/v1/tambo/hash', { content: 'x'.repeat(10000) }),
    50
  );
  
  // Large content
  results.hash_large = await benchmark(
    'POST /hash (100KB)',
    () => httpPost('/v1/tambo/hash', { content: 'x'.repeat(100000) }),
    20
  );
  
  // Hash verification
  results.hash_verify = await benchmark(
    'POST /hash/verify',
    () => httpPost('/v1/tambo/hash/verify', {
      content: 'test content',
      hash: 'invalid_hash_for_test',
    }),
    50
  );
  
  // -------------------------------------------------------------------------
  // Spec Diff Benchmarks
  // -------------------------------------------------------------------------
  
  log('\n' + '-'.repeat(60), 'gray');
  log('Spec Diff Engine', 'blue');
  log('-'.repeat(60), 'gray');
  
  const specV1 = createTestSpec(10);
  const specV2 = createTestSpec(10);
  specV2.title = 'Modified Title';
  
  results.diff = await benchmark(
    'POST /diff (10 components)',
    () => httpPost('/v1/tambo/diff', { old_spec: specV1, new_spec: specV2 }),
    20
  );
  
  const diffResult = await httpPost('/v1/tambo/diff', { old_spec: specV1, new_spec: specV2 });
  const diff = JSON.parse(diffResult.body);
  
  results.diff_breaking = await benchmark(
    'POST /diff/breaking',
    () => httpPost('/v1/tambo/diff/breaking', { diff }),
    50
  );
  
  results.diff_summary = await benchmark(
    'POST /diff/summary',
    () => httpPost('/v1/tambo/diff/summary', { diff }),
    50
  );
  
  // -------------------------------------------------------------------------
  // A11y Engine Benchmarks
  // -------------------------------------------------------------------------
  
  log('\n' + '-'.repeat(60), 'gray');
  log('A11y Engine', 'blue');
  log('-'.repeat(60), 'gray');
  
  results.a11y_validate = await benchmark(
    'POST /a11y/validate (10 components)',
    () => httpPost('/v1/tambo/a11y/validate', { spec: createTestSpec(10) }),
    20
  );
  
  const a11yResult = await httpPost('/v1/tambo/a11y/validate', { spec: createTestSpec(5) });
  const a11y = JSON.parse(a11yResult.body);
  
  results.a11y_report = await benchmark(
    'POST /a11y/report',
    () => httpPost('/v1/tambo/a11y/report', { result: a11y }),
    50
  );
  
  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  
  log('\n' + '='.repeat(60), 'gray');
  log('Summary', 'blue');
  log('='.repeat(60), 'gray');
  
  const allResults = Object.entries(results);
  const totalErrors = allResults.reduce((sum, [, r]) => sum + r.errors, 0);
  const avgTimes = allResults.map(([, r]) => r.avg).filter(a => a > 0);
  const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
  
  log(`\nTotal benchmarks: ${allResults.length}`, 'gray');
  log(`Total errors: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
  log(`Overall average: ${overallAvg.toFixed(2)}ms`, 'blue');
  
  // Find slowest
  const slowest = allResults.sort((a, b) => b[1].avg - a[1].avg)[0];
  log(`Slowest endpoint: ${slowest[0]} (${slowest[1].avg.toFixed(2)}ms)`, 'yellow');
  
  // Find fastest
  const fastest = allResults.filter(([, r]) => r.avg > 0).sort((a, b) => a[1].avg - b[1].avg)[0];
  log(`Fastest endpoint: ${fastest[0]} (${fastest[1].avg.toFixed(2)}ms)`, 'green');
  
  log('\n' + '='.repeat(60), 'gray');
  log('Benchmark complete!', 'green');
  log('='.repeat(60), 'gray');
}

// Run benchmarks
runBenchmarks().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
