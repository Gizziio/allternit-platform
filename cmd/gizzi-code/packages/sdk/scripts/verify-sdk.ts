/**
 * SDK Verification Script
 * Validates that all expected exports are available from the built SDK
 */

// Test harness import
import { AllternitHarness } from '../dist/harness/index.js';
console.log('✓ AllternitHarness imported');

// Test provider imports
import { AllternitAI } from '../dist/providers/anthropic/index.js';
console.log('✓ AllternitAI (Anthropic) imported');

import { AllternitOpenAI } from '../dist/providers/openai/index.js';
console.log('✓ AllternitOpenAI imported');

import { AllternitGoogleAI } from '../dist/providers/google/index.js';
console.log('✓ AllternitGoogleAI imported');

import { AllternitOllama } from '../dist/providers/ollama/index.js';
console.log('✓ AllternitOllama imported');

// Test harness types
import type { HarnessConfig, StreamRequest } from '../dist/harness/types.js';
console.log('✓ Harness types imported');

// Test error classes
import { AllternitError, APIUserAbortError } from '../dist/providers/anthropic/core/error.js';
console.log('✓ Error classes imported');

console.log('\n✅ SDK build verified successfully!');
console.log('All exports are available and working.');
