import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import EnvironmentService from '../services/EnvironmentService';
import {
  EnvironmentCreate,
  EnvironmentUpdate,
} from '../models/Environment';
import { logger } from '../utils/logger';

// Request body schemas
const createEnvironmentSchema = {
  type: 'object',
  required: ['name', 'template_id', 'target_vps_id'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    template_id: { type: 'string', format: 'uuid' },
    target_vps_id: { type: 'string', format: 'uuid' },
    environment_variables: { type: 'object' },
    port_mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          host: { type: 'integer' },
          container: { type: 'integer' },
          protocol: { type: 'string', default: 'tcp' },
        },
      },
    },
    volume_mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          container: { type: 'string' },
          mode: { type: 'string', default: 'rw' },
        },
      },
    },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const updateEnvironmentSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    environment_variables: { type: 'object' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

export default async function environmentRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  
  // List all environment templates
  fastify.get('/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templates = await EnvironmentService.getAllTemplates();
      return reply.send({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      logger.error('Failed to get environment templates', { error });
      throw error;
    }
  });

  // Get template by ID
  fastify.get('/templates/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const template = await EnvironmentService.getTemplateById(id);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'Environment template not found',
            code: 'NOT_FOUND',
          },
        });
      }

      return reply.send({
        success: true,
        data: template,
      });
    } catch (error) {
      logger.error('Failed to get environment template', { error });
      throw error;
    }
  });

  // List all environments
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const environments = await EnvironmentService.getAllEnvironments();
      return reply.send({
        success: true,
        data: environments,
        count: environments.length,
      });
    } catch (error) {
      logger.error('Failed to get environments', { error });
      throw error;
    }
  });

  // Create new environment
  fastify.post('/', {
    schema: {
      body: createEnvironmentSchema,
    },
  }, async (request: FastifyRequest<{ Body: EnvironmentCreate }>, reply: FastifyReply) => {
    try {
      const environment = await EnvironmentService.createEnvironment(request.body);
      return reply.status(202).send({
        success: true,
        data: environment,
        message: 'Environment provisioning initiated',
      });
    } catch (error) {
      logger.error('Failed to create environment', { error });
      throw error;
    }
  });

  // Get environment by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const environment = await EnvironmentService.getEnvironmentById(id);

      if (!environment) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'Environment not found',
            code: 'NOT_FOUND',
          },
        });
      }

      return reply.send({
        success: true,
        data: environment,
      });
    } catch (error) {
      logger.error('Failed to get environment', { error });
      throw error;
    }
  });

  // Update environment
  fastify.patch('/:id', {
    schema: {
      body: updateEnvironmentSchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: EnvironmentUpdate }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const environment = await EnvironmentService.updateEnvironment(id, request.body);
      return reply.send({
        success: true,
        data: environment,
        message: 'Environment updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update environment', { error });
      throw error;
    }
  });

  // Get environment logs
  fastify.get('/:id/logs', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { tail?: string; since?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const tail = request.query.tail ? parseInt(request.query.tail, 10) : 100;
      const logs = await EnvironmentService.getEnvironmentLogs(id, { tail });
      return reply.send({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error('Failed to get environment logs', { error });
      throw error;
    }
  });

  // Get environment events
  fastify.get('/:id/events', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const limit = parseInt(request.query.limit || '100', 10);
      const events = await EnvironmentService.getEnvironmentEvents(id, limit);
      return reply.send({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      logger.error('Failed to get environment events', { error });
      throw error;
    }
  });

  // Destroy environment
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await EnvironmentService.destroyEnvironment(id);
      return reply.send({
        success: true,
        message: 'Environment destroyed successfully',
      });
    } catch (error) {
      logger.error('Failed to destroy environment', { error });
      throw error;
    }
  });

  // WebSocket endpoint for real-time environment events
  fastify.get('/:id/events', { websocket: true }, (connection, request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;
    logger.info('WebSocket connection for environment events', { environmentId: id });

    // Send initial subscription confirmation
    connection.socket.send(JSON.stringify({
      type: 'subscribed',
      channel: `environment:${id}:events`,
    }));
  });
}
