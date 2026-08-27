import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
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

export function createAdminCommand(): Command {
  const workspaces = new Command('workspaces')
    .description('Manage platform workspaces')
    .addCommand(
      new Command('list').action(function (this: Command) {
        return run(this, () => client(this).request('GET', '/api/v1/workspaces'));
      }),
    )
    .addCommand(
      new Command('create')
        .requiredOption('--name <name>', 'workspace name')
        .option('--slug <slug>', 'workspace slug')
        .option('--description <description>', 'workspace description')
        .action(function (this: Command, options: { name: string; slug?: string; description?: string }) {
          return run(this, () => client(this).request('POST', '/api/v1/workspaces', options));
        }),
    )
    .addCommand(
      new Command('update')
        .argument('<id>', 'workspace id')
        .option('--name <name>', 'workspace name')
        .option('--description <description>', 'workspace description')
        .action(function (this: Command, id: string, options: { name?: string; description?: string }) {
          return run(this, () => client(this).request(
            'PUT',
            `/api/v1/workspaces/${encodeURIComponent(id)}`,
            options,
          ));
        }),
    )
    .addCommand(
      new Command('delete')
        .argument('<id>', 'workspace id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request('DELETE', `/api/v1/workspaces/${encodeURIComponent(id)}`));
        }),
    );

  const keys = new Command('keys')
    .description('Manage LLM gateway keys')
    .addCommand(
      new Command('list').action(function (this: Command) {
        return run(this, () => client(this).request('GET', '/api/v1/gateway/keys'));
      }),
    )
    .addCommand(
      new Command('create')
        .option('--name <name>', 'key name')
        .option('--monthly-budget-cents <cents>', 'monthly budget in cents', Number)
        .option('--rate-limit-rpm <rpm>', 'requests per minute', Number)
        .action(function (this: Command, options: Record<string, unknown>) {
          return run(this, () => client(this).request('POST', '/api/v1/gateway/keys', {
            name: options.name,
            monthly_budget_cents: options.monthlyBudgetCents,
            rate_limit_rpm: options.rateLimitRpm,
          }));
        }),
    )
    .addCommand(
      new Command('revoke')
        .argument('<id>', 'key id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request('DELETE', `/api/v1/gateway/keys/${encodeURIComponent(id)}`));
        }),
    )
    .addCommand(
      new Command('update')
        .argument('<id>', 'key id')
        .option('--name <name>', 'key name')
        .option('--monthly-budget-cents <cents>', 'monthly budget in cents', Number)
        .option('--rate-limit-rpm <rpm>', 'requests per minute', Number)
        .option('--allowed-models <models>', 'comma-separated model allowlist')
        .action(function (this: Command, id: string, options: Record<string, unknown>) {
          return run(this, () => client(this).request(
            'PATCH',
            `/api/v1/gateway/keys/${encodeURIComponent(id)}`,
            {
              name: options.name,
              monthly_budget_cents: options.monthlyBudgetCents,
              rate_limit_rpm: options.rateLimitRpm,
              allowed_models: typeof options.allowedModels === 'string'
                ? options.allowedModels.split(',').map((model) => model.trim()).filter(Boolean)
                : undefined,
            },
          ));
        }),
    )
    .addCommand(
      new Command('delete')
        .alias('remove')
        .argument('<id>', 'key id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request('DELETE', `/api/v1/gateway/keys/${encodeURIComponent(id)}`));
        }),
    );

  const budgets = new Command('budgets')
    .description('Manage LLM gateway budgets')
    .addCommand(
      new Command('list').action(function (this: Command) {
        return run(this, () => client(this).request('GET', '/api/v1/gateway/budgets'));
      }),
    )
    .addCommand(
      new Command('set')
        .requiredOption('--monthly-cents <cents>', 'monthly budget in cents', Number)
        .option('--soft', 'report overages without blocking')
        .action(function (this: Command, options: { monthlyCents: number; soft?: boolean }) {
          return run(this, () => client(this).request('PUT', '/api/v1/gateway/budgets', {
            budget_cents: options.monthlyCents,
            hard: !options.soft,
          }));
        }),
    )
    .addCommand(
      new Command('reset')
        .description('Remove budget enforcement')
        .action(function (this: Command) {
          return run(this, () => client(this).request('PUT', '/api/v1/gateway/budgets', {
            budget_cents: 0,
            hard: false,
          }));
        }),
    );

  const mcpTunnels = new Command('mcp-tunnels')
    .description('Manage MCP tunnel proxies')
    .addCommand(
      new Command('list').action(function (this: Command) {
        return run(this, () => client(this).request('GET', '/api/v1/admin/mcp-tunnels'));
      }),
    )
    .addCommand(
      new Command('create')
        .requiredOption('--name <name>', 'tunnel name')
        .requiredOption('--endpoint-url <url>', 'MCP server endpoint URL')
        .option('--description <description>', 'tunnel description')
        .option('--client-cert-pem <path>', 'path to mTLS client certificate PEM file')
        .option('--oauth-issuer <url>', 'allowed OAuth issuer URL')
        .option('--audience <audience>', 'allowed OAuth audience')
        .action(async function (this: Command, options: {
          name: string;
          endpointUrl: string;
          description?: string;
          clientCertPem?: string;
          oauthIssuer?: string;
          audience?: string;
        }) {
          const body: Record<string, unknown> = {
            name: options.name,
            endpoint_url: options.endpointUrl,
          };
          if (options.description) body.description = options.description;
          if (options.clientCertPem) {
            const pem = await readFile(options.clientCertPem, 'utf8');
            body.client_cert_pem = pem;
          }
          if (options.oauthIssuer) body.oauth_issuer = options.oauthIssuer;
          if (options.audience) body.audience = options.audience;
          return run(this, () => client(this).request('POST', '/api/v1/admin/mcp-tunnels', body));
        }),
    )
    .addCommand(
      new Command('get')
        .argument('<id>', 'tunnel id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request('GET', `/api/v1/admin/mcp-tunnels/${encodeURIComponent(id)}`));
        }),
    )
    .addCommand(
      new Command('update')
        .argument('<id>', 'tunnel id')
        .option('--name <name>', 'tunnel name')
        .option('--endpoint-url <url>', 'MCP server endpoint URL')
        .option('--description <description>', 'tunnel description')
        .option('--oauth-issuer <url>', 'allowed OAuth issuer URL')
        .option('--audience <audience>', 'allowed OAuth audience')
        .action(function (this: Command, id: string, options: {
          name?: string;
          endpointUrl?: string;
          description?: string;
          oauthIssuer?: string;
          audience?: string;
        }) {
          const body: Record<string, unknown> = {};
          if (options.name) body.name = options.name;
          if (options.endpointUrl) body.endpoint_url = options.endpointUrl;
          if (options.description !== undefined) body.description = options.description;
          if (options.oauthIssuer !== undefined) body.oauth_issuer = options.oauthIssuer;
          if (options.audience !== undefined) body.audience = options.audience;
          return run(this, () => client(this).request('PUT', `/api/v1/admin/mcp-tunnels/${encodeURIComponent(id)}`, body));
        }),
    )
    .addCommand(
      new Command('rotate')
        .argument('<id>', 'tunnel id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request(
            'POST',
            `/api/v1/admin/mcp-tunnels/${encodeURIComponent(id)}/rotate`,
          ));
        }),
    )
    .addCommand(
      new Command('reveal')
        .argument('<id>', 'tunnel id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request(
            'POST',
            `/api/v1/admin/mcp-tunnels/${encodeURIComponent(id)}/reveal`,
          ));
        }),
    )
    .addCommand(
      new Command('delete')
        .argument('<id>', 'tunnel id')
        .action(function (this: Command, id: string) {
          return run(this, () => client(this).request(
            'DELETE',
            `/api/v1/admin/mcp-tunnels/${encodeURIComponent(id)}`,
          ));
        }),
    );

  const inferenceHooks = new Command('inference-hooks')
    .description('Manage LLM gateway inference hooks')
    .addCommand(
      new Command('list').action(function (this: Command) {
        return run(this, () => client(this).request('GET', '/api/v1/gateway/inference-hooks'));
      }),
    )
    .addCommand(
      new Command('create')
        .option('--pre-url <url>', 'pre-inference webhook URL')
        .option('--post-url <url>', 'post-inference webhook URL')
        .option('--abort-on-pre-error [value]', 'abort request when pre-hook fails (true/false)', 'true')
        .action(function (this: Command, options: { preUrl?: string; postUrl?: string; abortOnPreError?: string }) {
          return run(this, () => client(this).request('POST', '/api/v1/gateway/inference-hooks', {
            pre_inference_url: options.preUrl,
            post_inference_url: options.postUrl,
            abort_on_pre_error: options.abortOnPreError === 'true',
          }));
        }),
    )
    .addCommand(
      new Command('update')
        .option('--pre-url <url>', 'pre-inference webhook URL')
        .option('--post-url <url>', 'post-inference webhook URL')
        .option('--abort-on-pre-error [value]', 'abort request when pre-hook fails (true/false)')
        .action(function (this: Command, options: { preUrl?: string; postUrl?: string; abortOnPreError?: string }) {
          const payload: Record<string, unknown> = {};
          if (options.preUrl !== undefined) payload.pre_inference_url = options.preUrl;
          if (options.postUrl !== undefined) payload.post_inference_url = options.postUrl;
          if (options.abortOnPreError !== undefined) payload.abort_on_pre_error = options.abortOnPreError === 'true';
          return run(this, () => client(this).request('PUT', '/api/v1/gateway/inference-hooks', payload));
        }),
    )
    .addCommand(
      new Command('delete').action(function (this: Command) {
        return run(this, () => client(this).request('DELETE', '/api/v1/gateway/inference-hooks'));
      }),
    );

  return new Command('admin')
    .description('Administer platform resources')
    .addCommand(workspaces)
    .addCommand(keys)
    .addCommand(budgets)
    .addCommand(mcpTunnels)
    .addCommand(inferenceHooks);
}

export const adminCommand = createAdminCommand();
