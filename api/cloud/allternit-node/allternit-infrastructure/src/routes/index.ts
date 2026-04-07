import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import vpsRoutes from './vps';
import cloudRoutes from './cloud';
import environmentRoutes from './environments';
import sshKeyRoutes from './ssh-keys';
import { healthCheck as dbHealthCheck } from '../config/database';
import { healthCheck as redisHealthCheck } from '../config/redis';
import WebSocketService from '../services/WebSocketService';
import { logger } from '../utils/logger';

export default async function routes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  
  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([
      dbHealthCheck(),
      redisHealthCheck(),
    ]);

    const overallHealth = dbHealth.healthy && redisHealth.healthy;

    return reply.status(overallHealth ? 200 : 503).send({
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbHealth.healthy ? 'up' : 'down',
          latency: `${dbHealth.latency}ms`,
          ...(dbHealth.message && { message: dbHealth.message }),
        },
        redis: {
          status: redisHealth.healthy ? 'up' : 'down',
          latency: `${redisHealth.latency}ms`,
          ...(redisHealth.message && { message: redisHealth.message }),
        },
        websocket: {
          status: 'up',
          connected_clients: WebSocketService.getClientCount(),
          active_subscriptions: WebSocketService.getSubscriptionCount(),
        },
      },
    });
  });

  // API status endpoint
  fastify.get('/status', async (_request, reply) => {
    return reply.send({
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      platform: process.platform,
    });
  });

  // Register API routes with version prefix
  const apiVersion = 'v1';
  const apiPrefix = `/api/${apiVersion}`;

  // VPS routes
  fastify.register(vpsRoutes, { prefix: `${apiPrefix}/vps` });

  // Cloud provider routes
  fastify.register(cloudRoutes, { prefix: `${apiPrefix}/cloud` });

  // Environment routes
  fastify.register(environmentRoutes, { prefix: `${apiPrefix}/environments` });

  // SSH key routes
  fastify.register(sshKeyRoutes, { prefix: `${apiPrefix}/ssh-keys` });

  // Catch-all 404 handler
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
      },
    });
  });

  logger.info('Routes registered', { prefix: apiPrefix });
}
