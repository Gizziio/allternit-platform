import { cmd } from './cmd';
import { runtimeListCommand } from './runtime/list';
import { runtimeRegisterCommand } from './runtime/register';
import { runtimeStatusCommand } from './runtime/status';
import { runtimeDaemonCommand } from './runtime/daemon';

export const RuntimeCommand = cmd({
  command: 'runtime',
  describe: 'manage local agent runtime discovery',
  builder: (yargs) =>
    yargs
      .command(
        'list',
        'List all registered runtimes',
        () => {},
        async () => { await runtimeListCommand(); }
      )
      .command(
        'register [name] [host]',
        'Discover and register local agent CLIs as a runtime',
        (y) =>
          y
            .positional('name', { type: 'string', default: 'local', describe: 'Runtime name' })
            .positional('host', { type: 'string', default: 'localhost', describe: 'Runtime host' }),
        async (argv) => { await runtimeRegisterCommand([argv.name as string, argv.host as string]); }
      )
      .command(
        'status [id]',
        'Show runtime registry status',
        (y) =>
          y.positional('id', { type: 'string', describe: 'Runtime ID (optional)' }),
        async (argv) => { await runtimeStatusCommand(argv.id ? [argv.id as string] : []); }
      )
      .command(
        'daemon',
        'Start a WebSocket runtime daemon',
        (y) =>
          y
            .option('host', { type: 'string', default: '127.0.0.1', describe: 'Bind host' })
            .option('port', { type: 'number', describe: 'Bind port (0 = random)' })
            .option('name', { type: 'string', describe: 'Runtime display name' }),
        async (argv) => {
          const args: string[] = [];
          if (argv.host) args.push(`--host=${argv.host}`);
          if (argv.port) args.push(`--port=${argv.port}`);
          if (argv.name) args.push(`--name=${argv.name}`);
          await runtimeDaemonCommand(args);
        }
      )
      .demandCommand(1, 'Specify a subcommand: list | register | status | daemon'),
  handler: () => {},
});
