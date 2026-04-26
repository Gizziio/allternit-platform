import { cmd } from './cmd';
import { runtimeListCommand } from './runtime/list';
import { runtimeRegisterCommand } from './runtime/register';
import { runtimeStatusCommand } from './runtime/status';

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
      .demandCommand(1, 'Specify a subcommand: list | register | status'),
  handler: () => {},
});
