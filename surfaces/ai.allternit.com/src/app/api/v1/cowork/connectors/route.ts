import { NextResponse } from 'next/server';
import { CONNECTOR_MANIFEST } from '@/lib/cowork/connectors-manifest';

export const runtime = 'nodejs';

export async function GET() {
  const connectors = CONNECTOR_MANIFEST.map((connector) => {
    const missingRequired = connector.envVars
      .filter((v) => v.required && !process.env[v.key])
      .map((v) => v.key);

    const status: 'connected' | 'unconfigured' =
      missingRequired.length === 0 ? 'connected' : 'unconfigured';

    return {
      ...connector,
      status,
      missingVars: missingRequired,
    };
  });

  const summary = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status === 'connected').length,
    unconfigured: connectors.filter((c) => c.status === 'unconfigured').length,
  };

  return NextResponse.json({ connectors, summary });
}
