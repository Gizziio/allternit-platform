/**
 * Stream events
 *
 * Consumes every normalized event from an AllternitHarness stream and logs it
 * to stdout. Set ANTHROPIC_API_KEY before running.
 */

import { AllternitHarness } from '@allternit/sdk';

async function main() {
  const harness = new AllternitHarness({
    mode: 'byok',
    byok: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    },
  });

  const stream = harness.stream({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      { role: 'user', content: 'Explain async generators in TypeScript.' },
    ],
  });

  for await (const chunk of stream) {
    console.log(JSON.stringify(chunk));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
