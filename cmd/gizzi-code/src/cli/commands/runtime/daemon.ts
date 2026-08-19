import { RuntimeDaemon } from '../../../runtime/daemon/runtime-daemon';

export async function runtimeDaemonCommand(args: string[]): Promise<void> {
  const host = args.find((a) => a.startsWith('--host='))?.split('=')[1] ?? '127.0.0.1';
  const portArg = args.find((a) => a.startsWith('--port='))?.split('=')[1];
  const port = portArg ? Number(portArg) : undefined;
  const name = args.find((a) => a.startsWith('--name='))?.split('=')[1];

  const daemon = await RuntimeDaemon.start({ host, port, runtimeName: name });

  process.stdout.write(
    `Runtime daemon started\n` +
    `  url:    ${daemon.url}\n` +
    `  id:     ${daemon.runtimeId}\n` +
    `  token:  ${daemon.token}\n\n` +
    `Press Ctrl+C to stop.\n`
  );

  process.on('SIGINT', () => {
    process.stdout.write('\nStopping runtime daemon...\n');
    daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    daemon.stop();
    process.exit(0);
  });

  // Keep the process alive.
  await new Promise(() => {});
}
