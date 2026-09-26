import { Command } from 'commander';
import { SubsClient } from '../subs/client.js';

type GlobalOptions = { json?: boolean };

interface AccountRow {
  account_id: string;
  provider: string;
  label: string;
  plan: string | null;
  session_health: string;
  enabled: boolean;
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

export function createSubsCommand(): Command {
  const subs = new Command('subs').description('Subscription fabric accounts (subscription-gateway)');

  subs.addCommand(
    new Command('list')
      .description('List connected subscription accounts')
      .action(function (this: Command) {
        return run(this, () => new SubsClient().requestOk<AccountRow[]>('GET', '/v1/accounts'));
      }),
  );

  subs.addCommand(
    new Command('status')
      .description('Show per-account session health')
      .action(async function (this: Command) {
        const client = new SubsClient();
        await run(this, async () => {
          const accounts = await client.requestOk<AccountRow[]>('GET', '/v1/accounts');
          const statuses = await Promise.all(
            accounts.map((a) =>
              client.requestOk('GET', `/v1/accounts/${a.account_id}/status`).catch(() => null),
            ),
          );
          return accounts.map((a, i) => ({ ...a, status: statuses[i] }));
        });
      }),
  );

  subs.addCommand(
    new Command('connect')
      .description('Connect a provider account — the Sessions window opens for an interactive login')
      .argument('<provider>', 'provider id (see `allternit caps list`)')
      .option('--label <label>', 'account label')
      .action(function (this: Command, provider: string, options: { label?: string }) {
        return run(this, async () => {
          const account = await new SubsClient().requestOk('POST', '/v1/accounts', {
            provider,
            label: options.label ?? provider,
          });
          process.stderr.write(
            'Account created. Log in in the Sessions window that the gateway brings forward; ' +
              'health flips to ready once the probe passes.\n',
          );
          return account;
        });
      }),
  );

  subs.addCommand(
    new Command('disconnect')
      .description('Disable an account (does not wipe the profile)')
      .argument('<id>', 'account id')
      .action(function (this: Command, id: string) {
        return run(this, () => new SubsClient().requestOk('POST', `/v1/accounts/${id}/disconnect`));
      }),
  );

  return subs;
}

export const subsCommand = createSubsCommand();
