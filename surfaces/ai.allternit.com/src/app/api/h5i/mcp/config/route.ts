import { NextResponse } from 'next/server';
import { getH5iMcpConfig, isH5iMcpAvailable } from '@/lib/h5i/service';

export async function GET(): Promise<NextResponse> {
  const mcpAvailable = isH5iMcpAvailable();
  const config = getH5iMcpConfig();

  return NextResponse.json({
    mcpAvailable,
    config,
    claudeSettings: {
      mcpServers: {
        h5i: {
          command: config.command,
          args: config.args,
        },
      },
    },
  });
}
