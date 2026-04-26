/**
 * BYOK (Bring Your Own Key) Example
 * 
 * This example demonstrates how to use the Allternit SDK with your own
 * API keys for various AI providers.
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  // Initialize the harness in BYOK mode with multiple providers
  const harness = new AllternitHarness({
    mode: 'byok',
    byok: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
      }
    }
  });

  console.log('=== BYOK Mode Example ===\n');

  // Example 1: Streaming with Anthropic
  console.log('1. Streaming with Anthropic:');
  try {
    const anthropicStream = harness.stream({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Explain quantum computing in one sentence.' }]
    });

    process.stdout.write('   Response: ');
    for await (const chunk of anthropicStream) {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.text);
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }

  // Example 2: Non-streaming completion with OpenAI
  console.log('2. Non-streaming completion with OpenAI:');
  try {
    const response = await harness.complete({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'What is the capital of France?' }]
    });

    console.log('   Response:', response.content);
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }

  // Example 3: Multi-turn conversation
  console.log('\n3. Multi-turn conversation:');
  try {
    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'What is TypeScript?' },
      { role: 'assistant' as const, content: 'TypeScript is a typed superset of JavaScript.' },
      { role: 'user' as const, content: 'Why should I use it?' }
    ];

    const stream = harness.stream({
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      messages
    });

    process.stdout.write('   Response: ');
    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.text);
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }
}

main().catch(console.error);
