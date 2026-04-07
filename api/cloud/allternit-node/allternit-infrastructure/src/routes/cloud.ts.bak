import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import CloudProviderService from '../services/CloudProviderService';
import {
  CloudDeploymentCreate,
} from '../models/Deployment';
import { logger } from '../utils/logger';

// Request body schemas
const createDeploymentSchema = {
  type: 'object',
  required: ['name', 'provider', 'region', 'instance_type'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    provider: { type: 'string', enum: ['hetzner', 'digitalocean', 'aws', 'azure', 'gcp'] },
    region: { type: 'string', minLength: 1 },
    instance_type: { type: 'string', minLength: 1 },
    image: { type: 'string' },
    ssh_key_id: { type: 'string', format: 'uuid' },
    ssh_keys: { type: 'array', items: { type: 'string' } },
    user_data: { type: 'string' },
    volumes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          size: { type: 'integer' },
          name: { type: 'string' },
          format: { type: 'string' },
        },
      },
    },
    networks: { type: 'array', items: { type: 'string' } },
    labels: { type: 'object' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const estimateSchema = {
  type: 'object',
  required: ['provider', 'region', 'instance_type'],
  properties: {
    provider: { type: 'string' },
    region: { type: 'string' },
    instance_type: { type: 'string' },
    hours: { type: 'integer', default: 730 },
  },
};

export default async function cloudRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  
  // List available cloud providers
  fastify.get('/providers', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const providers = await CloudProviderService.getAllProvidersInfo();
      return reply.send({
        success: true,
        data: providers,
      });
    } catch (error) {
      logger.error('Failed to get providers', { error });
      throw error;
    }
  });

  // Get specific provider info
  fastify.get('/providers/:provider', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    try {
      const { provider } = request.params;
      const info = await CloudProviderService.getProviderInfo(provider);
      return reply.send({
        success: true,
        data: info,
      });
    } catch (error) {
      logger.error('Failed to get provider info', { error });
      throw error;
    }
  });

  // Validate provider credentials
  fastify.post('/providers/:provider/validate', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    try {
      const { provider } = request.params;
      const result = await CloudProviderService.validateCredentials(provider);
      return reply.send({
        success: result.valid,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to validate credentials', { error });
      throw error;
    }
  });

  // Get pricing estimate
  fastify.post('/estimate', {
    schema: {
      body: estimateSchema,
    },
  }, async (request: FastifyRequest<{ Body: { provider: string; region: string; instance_type: string; hours?: number } }>, reply: FastifyReply) => {
    try {
      const { provider, region, instance_type, hours } = request.body;
      const estimate = await CloudProviderService.getPricingEstimate(provider, region, instance_type, hours);
      return reply.send({
        success: true,
        data: estimate,
      });
    } catch (error) {
      logger.error('Failed to get pricing estimate', { error });
      throw error;
    }
  });

  // List all deployments
  fastify.get('/deployments', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deployments = await CloudProviderService.getAllDeployments();
      return reply.send({
        success: true,
        data: deployments,
        count: deployments.length,
      });
    } catch (error) {
      logger.error('Failed to get deployments', { error });
      throw error;
    }
  });

  // Create new deployment
  fastify.post('/deployments', {
    schema: {
      body: createDeploymentSchema,
    },
  }, async (request: FastifyRequest<{ Body: CloudDeploymentCreate }>, reply: FastifyReply) => {
    try {
      const deployment = await CloudProviderService.createDeployment(request.body);
      return reply.status(202).send({
        success: true,
        data: deployment,
        message: 'Deployment initiated successfully',
      });
    } catch (error) {
      logger.error('Failed to create deployment', { error });
      throw error;
    }
  });

  // Get deployment by ID
  fastify.get('/deployments/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const deployment = await CloudProviderService.getDeploymentById(id);

      if (!deployment) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'Deployment not found',
            code: 'NOT_FOUND',
          },
        });
      }

      return reply.send({
        success: true,
        data: deployment,
      });
    } catch (error) {
      logger.error('Failed to get deployment', { error });
      throw error;
    }
  });

  // Sync deployment status with provider
  fastify.post('/deployments/:id/sync', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const deployment = await CloudProviderService.syncDeploymentStatus(id);
      return reply.send({
        success: true,
        data: deployment,
        message: 'Deployment status synced successfully',
      });
    } catch (error) {
      logger.error('Failed to sync deployment status', { error });
      throw error;
    }
  });

  // Delete/Cancel deployment
  fastify.delete('/deployments/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await CloudProviderService.deleteDeployment(id);
      return reply.send({
        success: true,
        message: 'Deployment cancelled and resources released',
      });
    } catch (error) {
      logger.error('Failed to delete deployment', { error });
      throw error;
    }
  });

  // Get deployment events
  fastify.get('/deployments/:id/events', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const limit = parseInt(request.query.limit || '100', 10);
      const events = await CloudProviderService.getDeploymentEvents(id, limit);
      return reply.send({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      logger.error('Failed to get deployment events', { error });
      throw error;
    }
  });

  // WebSocket endpoint for real-time deployment events
  fastify.get('/deployments/:id/events', { websocket: true }, (connection, request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;
    logger.info('WebSocket connection for deployment events', { deploymentId: id });

    // Send initial subscription confirmation
    connection.socket.send(JSON.stringify({
      type: 'subscribed',
      channel: `deployment:${id}:events`,
    }));

    // The actual subscription and message routing is handled by WebSocketService
    // This endpoint just registers the connection
  });
}
