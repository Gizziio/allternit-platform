/**
 * POST /api/v1/runtime/backend/manual
 * 
 * Manually register a backend URL without SSH.
 * For users who have the backend running locally with a tunnel
 * (cloudflared, ngrok, etc.) or on a private network.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { getAuth } from '@/lib/server-auth';
import { syncRuntimeBackendPreferenceToClerk } from '@/lib/runtime-backend-clerk';
import { resolvePlatformUserId } from '@/lib/server-user';
import {
  ensureBackendPreference,
  setActiveRuntimeBackendPreference,
  verifyRuntimeBackendHealth,
} from '@/lib/runtime-backend';

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await getAuth();
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await resolvePlatformUserId(authUserId);
    const body = await request.json();

    const {
      name,
      gatewayUrl,
      gatewayWsUrl,
      gatewayToken,
    } = body;

    if (!name || !gatewayUrl) {
      return NextResponse.json(
        { error: 'name and gatewayUrl are required' },
        { status: 400 }
      );
    }

    // Verify the backend is reachable
    const health = await verifyRuntimeBackendHealth(gatewayUrl, {
      authorizationHeader: gatewayToken || null,
    });

    if (!health.reachable) {
      return NextResponse.json(
        { error: 'Backend is not reachable at the provided URL' },
        { status: 400 }
      );
    }

    // Create a synthetic SSH connection (represents the manual entry)
    const sshConnection = await prisma.sshConnection.create({
      data: {
        userId,
        name,
        host: new URL(gatewayUrl).hostname,
        port: 443,
        username: 'manual',
        authType: 'key',
        status: 'connected',
        a2rInstalled: true,
      },
    });

    // Create the backend target
    const wsUrl = gatewayWsUrl || gatewayUrl.replace(/^http/, 'ws');
    const backendTarget = await prisma.remoteBackendTarget.create({
      data: {
        userId,
        sshConnectionId: sshConnection.id,
        name,
        status: 'ready',
        installState: 'installed',
        gatewayUrl,
        gatewayWsUrl: wsUrl,
        backendUrl: gatewayUrl,
        encryptedGatewayToken: gatewayToken ? encrypt(gatewayToken) : null,
        lastVerifiedAt: new Date(),
      },
    });

    // Activate this backend
    await ensureBackendPreference(userId);
    await setActiveRuntimeBackendPreference({
      userId,
      mode: 'byoc-vps',
      fallbackMode: 'local',
      backendTargetId: backendTarget.id,
    });

    await syncRuntimeBackendPreferenceToClerk(authUserId).catch(() => {
      // Non-fatal
    });

    return NextResponse.json({
      success: true,
      message: 'Backend registered successfully',
      backend_target: {
        id: backendTarget.id,
        name: backendTarget.name,
        gateway_url: backendTarget.gatewayUrl,
        gateway_ws_url: backendTarget.gatewayWsUrl,
        status: backendTarget.status,
      },
    });
  } catch (error) {
    console.error('Manual backend registration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register backend' },
      { status: 500 }
    );
  }
}
