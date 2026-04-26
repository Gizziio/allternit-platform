import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import VPSService from '../services/VPSService';
import SSHKeyService from '../services/SSHKeyService';
import {
  VPSConnectionCreate,
  VPSConnectionUpdate,
} from '../models/VPSConnection';
import { logger } from '../utils/logger';

// Request body schemas
const createVPSSchema = {
  type: 'object',
  required: ['name', 'host', 'auth_type', 'username'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    host: { type: 'string', format: 'hostname' },
    port: { type: 'integer', minimum: 1, maximum: 65535, default: 22 },
    auth_type: { type: 'string', enum: ['password', 'private_key', 'ssh_agent'] },
    username: { type: 'string', minLength: 1 },
    password: { type: 'string' },
    private_key: { type: 'string' },
    passphrase: { type: 'string' },
    ssh_key_id: { type: 'string', format: 'uuid' },
    tags: { type: 'array', items: { type: 'string' } },
    metadata: { type: 'object' },
  },
};

const updateVPSSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    host: { type: 'string', format: 'hostname' },
    port: { type: 'integer', minimum: 1, maximum: 65535 },
    auth_type: { type: 'string', enum: ['password', 'private_key', 'ssh_agent'] },
    username: { type: 'string', minLength: 1 },
    password: { type: 'string' },
    private_key: { type: 'string' },
    passphrase: { type: 'string' },
    ssh_key_id: { type: 'string', format: 'uuid' },
    tags: { type: 'array', items: { type: 'string' } },
    metadata: { type: 'object' },
  },
};

const execCommandSchema = {
  type: 'object',
  required: ['command'],
  properties: {
    command: { type: 'string', minLength: 1 },
    timeout: { type: 'integer', minimum: 1000, maximum: 300000, default: 30000 },
  },
};

const installNodeSchema = {
  type: 'object',
  properties: {
    version: { type: 'string', default: 'latest' },
    port: { type: 'integer', minimum: 1, maximum: 65535, default: 8080 },
  },
};

export default async function vpsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Get all VPS connections
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connections = await VPSService.getAllConnections();
      return reply.send({
        success: true,
        data: connections,
        count: connections.length,
      });
    } catch (error) {
      logger.error('Failed to get VPS connections', { error });
      throw error;
    }
  });

  // Get VPS connection by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const connection = await VPSService.getConnectionById(id);

      if (!connection) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'VPS connection not found',
            code: 'NOT_FOUND',
          },
        });
      }

      return reply.send({
        success: true,
        data: connection,
      });
    } catch (error) {
      logger.error('Failed to get VPS connection', { error });
      throw error;
    }
  });

  // Create new VPS connection
  fastify.post('/', {
    schema: {
      body: createVPSSchema,
    },
  }, async (request: FastifyRequest<{ Body: VPSConnectionCreate }>, reply: FastifyReply) => {
    try {
      const connection = await VPSService.createConnection(request.body);
      return reply.status(201).send({
        success: true,
        data: connection,
        message: 'VPS connection created successfully',
      });
    } catch (error) {
      logger.error('Failed to create VPS connection', { error });
      throw error;
    }
  });

  // Update VPS connection
  fastify.patch('/:id', {
    schema: {
      body: updateVPSSchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: VPSConnectionUpdate }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const connection = await VPSService.updateConnection(id, request.body);
      return reply.send({
        success: true,
        data: connection,
        message: 'VPS connection updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update VPS connection', { error });
      throw error;
    }
  });

  // Delete VPS connection
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await VPSService.deleteConnection(id);
      return reply.send({
        success: true,
        message: 'VPS connection deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete VPS connection', { error });
      throw error;
    }
  });

  // Test VPS connection
  fastify.post('/:id/test', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const result = await VPSService.testConnection(id);
      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to test VPS connection', { error });
      throw error;
    }
  });

  // Execute command on VPS
  fastify.post('/:id/exec', {
    schema: {
      body: execCommandSchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { command: string; timeout?: number } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { command, timeout } = request.body;
      
      const result = await VPSService.executeCommand(id, command, timeout);
      return reply.send({
        success: result.exit_code === 0,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to execute command', { error });
      throw error;
    }
  });

  // Install Allternit node on VPS
  fastify.post('/:id/install', {
    schema: {
      body: installNodeSchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { version?: string; port?: number } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const result = await VPSService.installAllternitNode(id, request.body);
      return reply.send({
        success: result.success,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to install Allternit node', { error });
      throw error;
    }
  });

  // Get connection history/attempts
  fastify.get('/:id/history', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const limit = parseInt(request.query.limit || '50', 10);
      const attempts = await VPSService.getConnectionAttempts(id, limit);
      return reply.send({
        success: true,
        data: attempts,
        count: attempts.length,
      });
    } catch (error) {
      logger.error('Failed to get connection history', { error });
      throw error;
    }
  });

  // Get SSH keys distributed to this VPS
  fastify.get('/:id/ssh-keys', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const distributions = await SSHKeyService.getVPSDistributions(id);
      return reply.send({
        success: true,
        data: distributions,
        count: distributions.length,
      });
    } catch (error) {
      logger.error('Failed to get VPS SSH keys', { error });
      throw error;
    }
  });
}
