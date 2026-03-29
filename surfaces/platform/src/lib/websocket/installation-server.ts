/**
 * Socket.IO Installation Server
 * 
 * Handles real-time backend installation progress updates.
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { backendInstaller, type InstallProgress } from '@/services/backend/BackendInstallerService';

let io: SocketIOServer | null = null;

interface InstallationSocket extends SocketIO.Socket {
  installationId?: string;
}

export function createInstallationServer(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: '/api/v1/backend-install/progress',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: InstallationSocket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // Subscribe to installation progress
    socket.on('subscribe', ({ installation_id }: { installation_id: string }) => {
      socket.installationId = installation_id;
      socket.join(`install:${installation_id}`);
      console.log(`[Socket.IO] Client subscribed to: ${installation_id}`);
    });

    // Start installation
    socket.on('start_installation', async (data: {
      installation_id: string;
      host: string;
      port: number;
      username: string;
      private_key?: string;
      password?: string;
    }) => {
      const { installation_id, host, port, username, private_key, password } = data;
      
      socket.join(`install:${installation_id}`);
      console.log(`[Socket.IO] Starting installation: ${installation_id}`);

      try {
        const result = await backendInstaller.installBackend(
          installation_id,
          { host, port, username, privateKey: private_key, password },
          (progress: InstallProgress) => {
            // Broadcast progress to all subscribers
            io?.to(`install:${installation_id}`).emit('progress', progress);
          }
        );

        // Installation complete
        io?.to(`install:${installation_id}`).emit('complete', result);
        
        // Clean up room after a delay
        setTimeout(() => {
          io?.socketsLeave(`install:${installation_id}`);
        }, 60000);

      } catch (error) {
        io?.to(`install:${installation_id}`).emit('error', {
          message: error instanceof Error ? error.message : 'Installation failed',
        });
      }
    });

    // Abort installation
    socket.on('abort', ({ installation_id }: { installation_id: string }) => {
      console.log(`[Socket.IO] Aborting installation: ${installation_id}`);
      backendInstaller.abortInstallation(installation_id);
      socket.to(`install:${installation_id}`).emit('aborted');
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
