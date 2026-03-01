/**
 * Playground Relay Service
 *
 * HTTP relay for playground state synchronization between browser and agents.
 */

import express from 'express';
import type { Playground, PlaygroundEvent, PlaygroundEventRequest, CreatePlaygroundRequest, UpdatePlaygroundRequest } from './types';
import { playgroundStore } from './store';

export class PlaygroundRelayService {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3050) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'playground-relay' });
    });

    // List all playgrounds
    this.app.get('/playgrounds', async (req, res) => {
      try {
        const playgrounds = await playgroundStore.list();
        res.json({ playgrounds, total: playgrounds.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list playgrounds' });
      }
    });

    // Get single playground
    this.app.get('/playgrounds/:id', async (req, res) => {
      try {
        const playground = await playgroundStore.get(req.params.id);
        if (!playground) {
          return res.status(404).json({ error: 'Playground not found' });
        }
        res.json(playground);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get playground' });
      }
    });

    // Create playground
    this.app.post('/playgrounds', async (req, res) => {
      try {
        const request: CreatePlaygroundRequest = req.body;
        if (!request.title || !request.templateType) {
          return res.status(400).json({ error: 'Title and templateType required' });
        }
        const playground = await playgroundStore.create(request);
        res.status(201).json(playground);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create playground' });
      }
    });

    // Update playground
    this.app.put('/playgrounds/:id', async (req, res) => {
      try {
        const request: UpdatePlaygroundRequest = req.body;
        const playground = await playgroundStore.update(req.params.id, request);
        if (!playground) {
          return res.status(404).json({ error: 'Playground not found' });
        }
        res.json(playground);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update playground' });
      }
    });

    // Delete playground
    this.app.delete('/playgrounds/:id', async (req, res) => {
      try {
        const deleted = await playgroundStore.delete(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: 'Playground not found' });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete playground' });
      }
    });

    // Emit event
    this.app.post('/playgrounds/:id/events', async (req, res) => {
      try {
        const request: PlaygroundEventRequest = req.body;
        if (!request.type) {
          return res.status(400).json({ error: 'Event type required' });
        }

        const event: PlaygroundEvent = {
          id: `evt_${Date.now()}`,
          playgroundId: req.params.id,
          type: request.type,
          timestamp: new Date().toISOString(),
          data: request.data,
        };

        await playgroundStore.emitEvent(req.params.id, event);
        res.status(201).json(event);
      } catch (error) {
        res.status(500).json({ error: 'Failed to emit event' });
      }
    });

    // Watch events (SSE)
    this.app.get('/playgrounds/:id/watch', async (req, res) => {
      const playgroundId = req.params.id;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const listener = (event: PlaygroundEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = playgroundStore.subscribe(playgroundId, listener);

      req.on('close', () => {
        unsubscribe();
      });

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', playgroundId })}\n\n`);
    });
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(this.port, () => {
        console.log(`[PlaygroundRelay] Service started on port ${this.port}`);
        resolve();
      }).on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // In a real implementation, we'd close the server
      console.log('[PlaygroundRelay] Service stopped');
      resolve();
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const playgroundRelay = new PlaygroundRelayService();
