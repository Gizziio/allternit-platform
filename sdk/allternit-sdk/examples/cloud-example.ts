/**
 * Cloud Mode Example
 * 
 * This example demonstrates how to use the Allternit SDK with
 * Allternit's managed cloud service.
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  // Initialize the harness in Cloud mode
  const harness = new AllternitHarness({
    mode: 'cloud',
    cloud: {
      baseURL: process.env.ALLTERNIT_API_URL || 'https://api.allternit.com',
      accessToken: process.env.ALLTERNIT_ACCESS_TOKEN || 'your-oauth-token'
    }
  });

  console.log('=== Cloud Mode Example ===\n');

  // Example 1: Basic streaming request
  console.log('1. Basic streaming request:');
  try {
    const stream = harness.stream({
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: 'Write a haiku about AI.' }]
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

  // Example 2: Request with custom parameters
  console.log('2. Request with custom parameters:');
  try {
    const stream = harness.stream({
      provider: 'openai',
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a creative writing assistant.' },
        { role: 'user', content: 'Give me a creative story starter about space exploration.' }
      ],
      temperature: 0.8,
      maxTokens: 150
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

  // Example 3: Non-streaming completion
  console.log('3. Non-streaming completion:');
  try {
    const response = await harness.complete({
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'List 3 benefits of using a managed AI service.' }]
    });

    console.log('   Response:', response.content);
    console.log('   Usage:', JSON.stringify(response.usage, null, 2));
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }

  // Example 4: Error handling
  console.log('\n4. Error handling example:');
  try {
    const stream = harness.stream({
      provider: 'anthropic',
      model: 'invalid-model',
      messages: [{ role: 'user', content: 'Test' }]
    });

    for await (const chunk of stream) {
      console.log(chunk);
    }
  } catch (error) {
    console.log('   Caught expected error:', error instanceof Error ? error.message : String(error));
  }
}

main().catch(console.error);
