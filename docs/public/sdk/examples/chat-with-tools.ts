/**
 * Chat with tools
 *
 * Runs a single prompt that may invoke a function-style tool. The example
 * prints text deltas, tool calls, and final usage. Set ANTHROPIC_API_KEY before
 * running.
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  const harness = new AllternitHarness({
    mode: 'byok',
    byok: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    },
  });

  const tools = [
    {
      name: 'get_weather',
      description: 'Get the current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' },
        },
        required: ['city'],
      },
    },
  ];

  const stream = harness.stream({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
    tools,
  });

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'text':
        process.stdout.write(chunk.text);
        break;
      case 'tool_call':
        console.log(`\n[tool_call] ${chunk.name}(${chunk.arguments})`);
        break;
      case 'tool_call_complete':
        console.log(`\n[tool_call_complete] ${chunk.name}:`, JSON.stringify(chunk.arguments));
        break;
      case 'tool_result':
        console.log(`\n[tool_result] ${chunk.toolCallId}: ${chunk.content}`);
        break;
      case 'done':
        console.log('\n[done] usage:', chunk.usage);
        break;
      case 'error':
        console.error('\n[error]', chunk.error);
        break;
      default:
        // citation and other chunk types are ignored in this example
        break;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
