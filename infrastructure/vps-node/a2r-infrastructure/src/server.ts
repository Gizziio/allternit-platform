import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import config from './config';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errors';
import routes from './routes';
import WebSocketService from './services/WebSocketService';
import { testConnection as testDbConnection } from './config/database';
import { connect as connectRedis } from './config/redis';

export async function createServer() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: config.server.isDevelopment ? logger : false,
    trustProxy: true,
    connectionTimeout: 30000,
    keepAliveTimeout: 60000,
  });

  // Register error handler
  fastify.setErrorHandler(errorHandler);

  // Register security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: config.server.isProduction ? undefined : false,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: config.cors.origin === '*' ? true : config.cors.origin.split(','),
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
    ],
  });

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: (req, context) => ({
      success: false,
      error: {
        message: `Rate limit exceeded. Try again in ${context.after}`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: context.after,
      },
    }),
  });

  // Register WebSocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
      },
    },
  });

  // Register Swagger documentation
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'A2R Infrastructure API',
        description: 'API for managing VPS connections, cloud deployments, environments, and SSH keys',
        version: '1.0.0',
        contact: {
          name: 'A2R Team',
        },
      },
      externalDocs: {
        url: 'https://docs.a2r.io',
        description: 'Find more info here',
      },
      host: `${config.server.host}:${config.server.port}`,
      schemes: config.server.isProduction ? ['https'] : ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'VPS', description: 'VPS connection management' },
        { name: 'Cloud', description: 'Cloud provider deployments' },
        { name: 'Environments', description: 'Environment provisioning' },
        { name: 'SSH Keys', description: 'SSH key management' },
      ],
      securityDefinitions: {
        apiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
        },
      },
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  // Register WebSocket handler
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      WebSocketService.handleConnection(connection, req);
    });
  });

  // Initialize WebSocket service
  WebSocketService.initialize(fastify);

  // Register API routes
  await fastify.register(routes);

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Close WebSocket connections
    await WebSocketService.shutdown();

    // Close Fastify server
    await fastify.close();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  // Listen for shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return fastify;
}

export async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected');

    // Create and start server
    const server = await createServer();

    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`🚀 Server running on http://${config.server.host}:${config.server.port}`);
    logger.info(`📚 API Documentation available at http://${config.server.host}:${config.server.port}/documentation`);
    logger.info(`🔌 WebSocket endpoint available at ws://${config.server.host}:${config.server.port}/ws`);

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    throw error;
  }
}

export default { createServer, startServer };
