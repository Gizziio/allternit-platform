/**
 * Run batch
 *
 * Sends multiple prompts concurrently and prints each response. Set
 * ANTHROPIC_API_KEY before running.
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  const harness = new AllternitHarness({
    mode: 'byok',
    byok: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    },
  });

  const prompts = [
    'What is TypeScript?',
    'What is the event loop in Node.js?',
    'What is a closure in JavaScript?',
  ];

  const results = await Promise.all(
    prompts.map((prompt) =>
      harness.complete({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: prompt }],
      }),
    ),
  );

  for (let i = 0; i < prompts.length; i += 1) {
    console.log(`Q: ${prompts[i]}`);
    console.log(`A: ${results[i]}`);
    console.log('---');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
