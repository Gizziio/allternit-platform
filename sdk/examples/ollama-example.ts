/**
 * Local Mode (Ollama) Example
 * 
 * This example demonstrates how to use the Allternit SDK with
 * a local Ollama server for self-hosted AI models.
 * 
 * Prerequisites:
 * 1. Install Ollama: https://ollama.com
 * 2. Pull a model: `ollama pull llama2` or `ollama pull codellama`
 * 3. Start Ollama server: `ollama serve`
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  // Initialize the harness in Local mode for Ollama
  const harness = new AllternitHarness({
    mode: 'local',
    local: {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    }
  });

  console.log('=== Local Mode (Ollama) Example ===\n');

  // Example 1: Basic streaming with local model
  console.log('1. Basic streaming with local model:');
  try {
    const stream = harness.stream({
      provider: 'ollama',
      model: 'llama2',
      messages: [{ role: 'user', content: 'What is the difference between Python and JavaScript?' }]
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
    console.log('   Make sure Ollama is running: ollama serve');
  }

  // Example 2: Code assistance with CodeLlama
  console.log('2. Code assistance with CodeLlama:');
  try {
    const stream = harness.stream({
      provider: 'ollama',
      model: 'codellama',
      messages: [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: 'Write a Python function to calculate fibonacci numbers.' }
      ]
    });

    process.stdout.write('   Response:\n   ');
    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.text.replace(/\n/g, '\n   '));
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
    console.log('   Make sure you have pulled codellama: ollama pull codellama');
  }

  // Example 3: Non-streaming completion
  console.log('3. Non-streaming completion:');
  try {
    const response = await harness.complete({
      provider: 'ollama',
      model: 'llama2',
      messages: [{ role: 'user', content: 'Name three benefits of using local AI models.' }]
    });

    console.log('   Response:', response.content);
    if (response.usage) {
      console.log('   Tokens used:', response.usage.totalTokens);
    }
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }

  // Example 4: Conversation with context
  console.log('\n4. Conversation with context:');
  try {
    const messages = [
      { role: 'user' as const, content: 'My name is Alice.' },
      { role: 'assistant' as const, content: 'Hello Alice! Nice to meet you.' },
      { role: 'user' as const, content: 'What is my name?' }
    ];

    const stream = harness.stream({
      provider: 'ollama',
      model: 'llama2',
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

  // Example 5: Custom parameters
  console.log('5. Request with custom temperature:');
  try {
    const stream = harness.stream({
      provider: 'ollama',
      model: 'llama2',
      messages: [{ role: 'user', content: 'Generate a creative story title.' }],
      temperature: 1.2, // Higher temperature for more creativity
      maxTokens: 50
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

  console.log('\n=== Tips for Local Mode ===');
  console.log('- Ensure Ollama is installed: https://ollama.com');
  console.log('- Start the server: ollama serve');
  console.log('- Pull models: ollama pull <model-name>');
  console.log('- List available models: ollama list');
  console.log('- No API keys required - everything runs locally!');
}

main().catch(console.error);
