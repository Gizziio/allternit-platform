import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { Command } from 'commander';
import { SubsClient, gatewayStateDir } from '../subs/client.js';

type GlobalOptions = { json?: boolean };

interface ArtifactRow {
  artifact_id: string;
  type: string;
  title: string | null;
  storage: {
    retrieval_state: string;
    local_path: string | null;
    sha256: string | null;
    size_bytes: number | null;
  };
  created_at: string;
}

function output(command: Command, value: unknown): void {
  const json = command.optsWithGlobals<GlobalOptions>().json;
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 2)}\n`);
}

export function createArtifactsCommand(): Command {
  const artifacts = new Command('artifacts').description('Subscription fabric artifacts');

  artifacts.addCommand(
    new Command('list')
      .description('List artifacts (metadata)')
      .action(async function (this: Command) {
        try {
          output(this, await new SubsClient().requestOk<ArtifactRow[]>('GET', '/v1/artifacts'));
        } catch (error) {
          process.stderr.write(`allternit: ${error instanceof Error ? error.message : String(error)}\n`);
          process.exitCode = 1;
        }
      }),
  );

  artifacts.addCommand(
    new Command('open')
      .description('Print the quarantined local path of an artifact; open it only with explicit consent (§A6.6)')
      .argument('<id>', 'artifact id')
      .option('--i-know-its-quarantined', 'acknowledge quarantine and shell out to `open`', false)
      .action(async function (this: Command, id: string, options: { iKnowItsQuarantined?: boolean }) {
        try {
          const artifact = await new SubsClient().requestOk<ArtifactRow>('GET', `/v1/artifacts/${id}`);
          if (artifact.storage.retrieval_state !== 'local' || !artifact.storage.local_path) {
            throw new Error(`artifact is not local (retrieval_state=${artifact.storage.retrieval_state})`);
          }
          const absPath = join(gatewayStateDir(), 'artifacts', artifact.storage.local_path);
          if (!options.iKnowItsQuarantined) {
            process.stdout.write(
              `${absPath}\n(quarantined provider output — untrusted. Re-run with --i-know-its-quarantined to open.)\n`,
            );
            return;
          }
          await new Promise<void>((resolve, reject) => {
            const child = spawn('open', [absPath], { stdio: 'ignore' });
            child.on('error', reject);
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`open exited ${code}`))));
          });
          process.stdout.write(`opened ${absPath}\n`);
        } catch (error) {
          process.stderr.write(`allternit: ${error instanceof Error ? error.message : String(error)}\n`);
          process.exitCode = 1;
        }
      }),
  );

  return artifacts;
}

export const artifactsCommand = createArtifactsCommand();
