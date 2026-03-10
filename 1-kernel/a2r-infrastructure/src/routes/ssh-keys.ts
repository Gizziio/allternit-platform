import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import SSHKeyService from '../services/SSHKeyService';
import {
  SSHKeyCreate,
  SSHKeyImport,
  SSHKeyUpdate,
} from '../models/SSHKey';
import { logger } from '../utils/logger';

// Request body schemas
const generateKeySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    key_type: { type: 'string', enum: ['rsa', 'ed25519', 'ecdsa'], default: 'ed25519' },
    key_size: { type: 'integer', minimum: 2048, maximum: 8192 },
    passphrase: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const importKeySchema = {
  type: 'object',
  required: ['name', 'public_key', 'private_key'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    public_key: { type: 'string', minLength: 1 },
    private_key: { type: 'string', minLength: 1 },
    passphrase: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const updateKeySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const distributeSchema = {
  type: 'object',
  required: ['vps_id'],
  properties: {
    vps_id: { type: 'string', format: 'uuid' },
  },
};

export default async function sshKeyRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  
  // List all SSH keys
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const keys = await SSHKeyService.getAllKeys();
      return reply.send({
        success: true,
        data: keys,
        count: keys.length,
      });
    } catch (error) {
      logger.error('Failed to get SSH keys', { error });
      throw error;
    }
  });

  // Get SSH key by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const key = await SSHKeyService.getKeyById(id);

      if (!key) {
        return reply.status(404).send({
          success: false,
          error: {
            message: 'SSH key not found',
            code: 'NOT_FOUND',
          },
        });
      }

      return reply.send({
        success: true,
        data: key,
      });
    } catch (error) {
      logger.error('Failed to get SSH key', { error });
      throw error;
    }
  });

  // Generate new SSH key
  fastify.post('/generate', {
    schema: {
      body: generateKeySchema,
    },
  }, async (request: FastifyRequest<{ Body: SSHKeyCreate }>, reply: FastifyReply) => {
    try {
      const key = await SSHKeyService.generateKey(request.body);
      return reply.status(201).send({
        success: true,
        data: key,
        message: 'SSH key generated successfully',
      });
    } catch (error) {
      logger.error('Failed to generate SSH key', { error });
      throw error;
    }
  });

  // Import existing SSH key
  fastify.post('/import', {
    schema: {
      body: importKeySchema,
    },
  }, async (request: FastifyRequest<{ Body: SSHKeyImport }>, reply: FastifyReply) => {
    try {
      const key = await SSHKeyService.importKey(request.body);
      return reply.status(201).send({
        success: true,
        data: key,
        message: 'SSH key imported successfully',
      });
    } catch (error) {
      logger.error('Failed to import SSH key', { error });
      throw error;
    }
  });

  // Update SSH key
  fastify.patch('/:id', {
    schema: {
      body: updateKeySchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: SSHKeyUpdate }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const key = await SSHKeyService.updateKey(id, request.body);
      return reply.send({
        success: true,
        data: key,
        message: 'SSH key updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update SSH key', { error });
      throw error;
    }
  });

  // Delete SSH key
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      await SSHKeyService.deleteKey(id);
      return reply.send({
        success: true,
        message: 'SSH key deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete SSH key', { error });
      throw error;
    }
  });

  // Distribute SSH key to VPS
  fastify.post('/:id/distribute', {
    schema: {
      body: distributeSchema,
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { vps_id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { vps_id } = request.body;
      
      const result = await SSHKeyService.distributeToVPS(id, vps_id);
      return reply.send({
        success: result.success,
        data: result,
        message: result.message,
      });
    } catch (error) {
      logger.error('Failed to distribute SSH key', { error });
      throw error;
    }
  });

  // Get key distributions
  fastify.get('/:id/distributions', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const distributions = await SSHKeyService.getKeyDistributions(id);
      return reply.send({
        success: true,
        data: distributions,
        count: distributions.length,
      });
    } catch (error) {
      logger.error('Failed to get key distributions', { error });
      throw error;
    }
  });
}
