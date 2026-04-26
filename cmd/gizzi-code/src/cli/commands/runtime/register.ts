import { discoverLocalRuntime, formatDiscoveryReport } from '../../../runtime/runtime-discovery';
import { runtimeRegistry } from '../../../runtime/runtime-registry';

export async function runtimeRegisterCommand(args: string[]): Promise<void> {
  const name = args[0] ?? 'local';
  const host = args[1] ?? 'localhost';

  process.stdout.write(`Discovering agent CLIs on ${host}...\n`);

  const runtime = await discoverLocalRuntime(host);
  const report = formatDiscoveryReport(runtime);
  process.stdout.write('\n' + report + '\n');

  if (runtime.agentClis.length === 0) {
    process.stdout.write('\nNo agent CLIs found — nothing registered.\n');
    return;
  }

  const entry = runtimeRegistry.upsertByHost(name, runtime);
  process.stdout.write(
    `\n\x1b[32m✓\x1b[0m Registered runtime "${entry.name}" (id: ${entry.id})\n` +
    `  ${entry.agentClis.length} agent CLI${entry.agentClis.length !== 1 ? 's' : ''} available.\n`
  );
}
