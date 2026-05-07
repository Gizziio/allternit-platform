/**
 * SSH Connections API - Test Connection
 * 
 * POST /api/v1/ssh-connections/test - Test SSH connection without saving
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NodeSSH } from 'node-ssh';
import { getAuth } from '@/lib/server-auth';
import { gatherSSHSystemInfo } from '@/lib/ssh-system-info';

// POST /api/v1/ssh-connections/test
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { host, port, username, auth_type, private_key, password } = body;

    // Validate required fields
    if (!host || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: host, username' },
        { status: 400 }
      );
    }

    // Build connection config
    const connectConfig: any = {
      host,
      port: port || 22,
      username,
      readyTimeout: 15000,
    };

    if (auth_type === 'key' && private_key) {
      connectConfig.privateKey = private_key;
    } else if (auth_type === 'password' && password) {
      connectConfig.password = password;
    } else {
      return NextResponse.json(
        { error: 'Invalid authentication configuration' },
        { status: 400 }
      );
    }

    // Dynamically import NodeSSH to avoid bundling issues
    const { NodeSSH } = await import('node-ssh');

    // Attempt connection
    const ssh = new NodeSSH();
    await ssh.connect(connectConfig);

    const systemInfo = await gatherSSHSystemInfo(ssh);

    // Close connection
    ssh.dispose();

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to the server',
      os: systemInfo.os,
      architecture: systemInfo.architecture,
      docker_installed: systemInfo.dockerInstalled,
      allternit_installed: systemInfo.allternitInstalled,
    });
  } catch (error) {
    console.error('SSH connection test failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 200 }); // Return 200 with success: false for test failures
  }
}
