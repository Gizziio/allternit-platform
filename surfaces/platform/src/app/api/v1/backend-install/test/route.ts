/**
 * POST /api/v1/backend-install/test
 * Legacy compatibility alias for SSH probing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { backendInstaller } from '@/services/backend/BackendInstallerService';
import { getAuth } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { host, port, username, private_key, password } = body;

    if (!host || !username) {
      return NextResponse.json(
        { error: 'Host and username are required' },
        { status: 400 }
      );
    }

    const result = await backendInstaller.testConnection({
      host,
      port: port || 22,
      username,
      privateKey: private_key,
      password,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        system_info: result.systemInfo,
        message: 'Successfully connected to the server',
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error,
      message: result.error,
    });
  } catch (error) {
    console.error('SSH test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
