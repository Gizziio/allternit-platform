import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../api-client.js';

type GlobalOptions = { apiUrl: string; token?: string; json?: boolean };

function client(command: Command): ApiClient {
  const options = command.optsWithGlobals<GlobalOptions>();
  return new ApiClient({ apiUrl: options.apiUrl, token: options.token });
}

function output(command: Command, value: unknown): void {
  const json = command.optsWithGlobals<GlobalOptions>().json;
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 2)}\n`);
}

async function run(command: Command, request: () => Promise<unknown>): Promise<void> {
  try {
    output(command, await request());
  } catch (error) {
    process.stderr.write(`allternit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export function createCloudCommand(): Command {
  const resourcesCreate = new Command('create')
    .description('Create a fabric resource by class')
    .requiredOption('--class <class>', 'resource class, e.g. gpu.m')
    .option('--display-name <name>', 'human-readable name')
    .action(function (this: Command, options: { class: string; displayName?: string }) {
      return run(this, () => client(this).request('POST', '/api/v1/fabric/resources', {
        class: options.class,
        display_name: options.displayName,
      }));
    });

  const resourcesTerminate = new Command('terminate')
    .description('Terminate a fabric resource')
    .argument('<id>', 'resource id')
    .action(function (this: Command, id: string) {
      return run(this, () => client(this).request(
        'POST',
        `/api/v1/fabric/resources/${encodeURIComponent(id)}/terminate`,
      ));
    });

  const resources = new Command('resources')
    .description('Manage fabric compute resources')
    .addCommand(resourcesCreate)
    .addCommand(resourcesTerminate);

  const creditsBalance = new Command('balance')
    .description('Show credit balance')
    .action(function (this: Command) {
      return run(this, () => client(this).request('GET', '/api/v1/credits/balance'));
    });

  const creditsTransactions = new Command('transactions')
    .description('List credit transactions')
    .option('--limit <limit>', 'maximum transactions', Number, 50)
    .action(function (this: Command, options: { limit: number }) {
      return run(this, () => client(this).request(
        'GET',
        `/api/v1/credits/transactions?limit=${encodeURIComponent(options.limit)}`,
      ));
    });

  const creditsBuy = new Command('buy')
    .description('Buy credits (default method: stripe)')
    .requiredOption('--amount <cents>', 'amount to buy in USD cents', Number)
    .option('--method <method>', 'payment method: stripe or crypto', 'stripe')
    .option('--reference-id <id>', 'external payment reference')
    .action(function (this: Command, options: { amount: number; method: string; referenceId?: string }) {
      return run(this, () => client(this).request('POST', '/api/v1/credits/purchase', {
        amount_cents: options.amount,
        method: options.method,
        idempotency_key: randomUUID(),
        reference_id: options.referenceId,
      }));
    });

  const credits = new Command('credits')
    .description('Manage Allternit credits')
    .addCommand(creditsBalance)
    .addCommand(creditsTransactions)
    .addCommand(creditsBuy);

  return new Command('cloud')
    .description('Manage Allternit Cloud resources and credits')
    .addCommand(resources)
    .addCommand(credits);
}

export const cloudCommand = createCloudCommand();
