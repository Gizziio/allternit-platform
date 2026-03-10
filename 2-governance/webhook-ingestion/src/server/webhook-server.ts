/**
 * Webhook HTTP Server
 * 
 * Fastify-based HTTP server for receiving webhooks.
 * Implements security, rate limiting, and idempotency.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { WebhookPayload, WebhookSource } from '../types/webhook.types.js';
import type { WebhookServiceConfig } from '../types/webhook.types.js';
import { normalizeWebhook, isSourceSupported } from '../normalizer/normalizer-registry.js';
import { verifySignatureForSource, verifyHmacSignature } from '../security/hmac-verifier.js';
import { AllowlistValidator, createDefaultAllowlistValidator } from '../security/allowlist-validator.js';
import { RateLimiter, createWebhookRateLimiter } from '../security/rate-limiter.js';
import { createDeduplicationStore, type DeduplicationStore } from '../idempotency/deduplication-store.js';
import { generateIdempotencyKey } from '../idempotency/key-generator.js';
import { RailsEventEmitter, createRailsEventEmitter, type RailsEventEmitter as RailsEventEmitterType } from '../rails/event-emitter.js';
import { ReceiptRecorder, createReceiptRecorder } from '../rails/receipt-recorder.js';
import { inferWorkRequestConfig, requiresAgentAction } from '../rails/work-request-creator.js';

/**
 * Webhook server configuration
 */
export interface WebhookServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  secrets: Map<string, string>; // source -> secret
  allowlistValidator: AllowlistValidator;
  rateLimiter: RateLimiter;
  deduplicationStore: DeduplicationStore;
  railsEmitter: RailsEventEmitterType;
  receiptRecorder: ReceiptRecorder;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Webhook server class
 */
export class WebhookServer {
  private fastify: FastifyInstance;
  private config: WebhookServerConfig;
  
  constructor(config: WebhookServerConfig) {
    this.fastify = Fastify({
      logger: {
        level: config.logLevel,
      },
    });
    this.config = config;
    
    this.setupPlugins();
    this.setupRoutes();
    this.setupErrorHandling();
  }
  
  /**
   * Setup Fastify plugins
   */
  private setupPlugins(): void {
    // CORS
    this.fastify.register(cors, {
      origin: this.config.corsOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
    });
    
    // Security headers
    this.fastify.register(helmet, {
      contentSecurityPolicy: false, // Disable for API
    });
  }
  
  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.fastify.get('/health', this.healthCheck.bind(this));
    
    // Webhook endpoint
    this.fastify.post('/webhook/:source', this.handleWebhook.bind(this));
    
    // Generic webhook endpoint (source in body)
    this.fastify.post('/webhook', this.handleGenericWebhook.bind(this));
  }
  
  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.fastify.setErrorHandler((error, request, reply) => {
      this.config.railsEmitter as unknown as { logger: { error: (msg: string) => void } };
      
      reply.status(error.statusCode || 500).send({
        error: error.name,
        message: error.message,
        statusCode: error.statusCode || 500,
      });
    });
  }
  
  /**
   * Health check handler
   */
  private async healthCheck(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const stats = await this.config.deduplicationStore.getStats();
    
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      stats: {
        deduplication: stats,
      },
    });
  }
  
  /**
   * Handle webhook with source in URL
   */
  private async handleWebhook(
    request: FastifyRequest<{ Params: { source: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { source } = request.params;
    
    // Validate source
    if (!this.isValidSource(source)) {
      reply.status(400).send({
        error: 'InvalidSource',
        message: `Unknown webhook source: ${source}`,
      });
      return;
    }
    
    // Parse body
    const rawBody = request.rawBody || JSON.stringify(request.body);
    let payload: WebhookPayload;
    
    try {
      payload = this.parseWebhookBody(source, request.body, rawBody);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.status(400).send({
        error: 'InvalidPayload',
        message: errorMessage,
      });
      return;
    }
    
    // Process webhook
    await this.processWebhook(payload, rawBody, request.headers, reply);
  }
  
  /**
   * Handle generic webhook (source in body)
   */
  private async handleGenericWebhook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const body = request.body as Record<string, unknown>;
    const source = body.source as string;
    
    if (!source || !this.isValidSource(source)) {
      reply.status(400).send({
        error: 'MissingSource',
        message: 'Source must be specified in body',
      });
      return;
    }
    
    const rawBody = JSON.stringify(body);
    let payload: WebhookPayload;
    
    try {
      payload = this.parseWebhookBody(source, body, rawBody);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.status(400).send({
        error: 'InvalidPayload',
        message: errorMessage,
      });
      return;
    }
    
    await this.processWebhook(payload, rawBody, request.headers, reply);
  }
  
  /**
   * Process webhook through full pipeline
   */
  private async processWebhook(
    payload: WebhookPayload,
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      // Step 1: Record webhook received
      await this.config.receiptRecorder.recordWebhookReceived(
        payload.source,
        payload.eventType,
        payload.id,
        correlationId
      );
      
      // Step 2: Rate limiting
      const rateLimitResult = await this.config.rateLimiter.checkAndRecord(
        `source:${payload.source}`
      );
      
      if (!rateLimitResult.allowed) {
        await this.config.receiptRecorder.record('rate_limited', {
          source: payload.source,
          reason: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
        }, { correlationId });
        
        reply.header('Retry-After', String(rateLimitResult.retryAfter || 60));
        reply.status(429).send({
          error: 'RateLimitExceeded',
          message: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
        });
        return;
      }
      
      // Step 3: Signature verification (if secret configured)
      const secret = this.config.secrets.get(payload.source);
      let signatureVerified = false;
      
      if (secret) {
        const verification = verifySignatureForSource(
          payload.source,
          rawBody,
          headers,
          secret
        );
        
        signatureVerified = verification.valid;
        
        await this.config.receiptRecorder.recordSignatureVerified(
          payload.source,
          verification.algorithm || 'unknown',
          verification.valid,
          correlationId
        );
        
        if (!verification.valid) {
          reply.status(401).send({
            error: 'SignatureInvalid',
            message: verification.error,
          });
          return;
        }
      }
      
      // Step 4: Allowlist check
      const allowlistResult = this.config.allowlistValidator.validate(
        payload.source,
        payload.eventType
      );
      
      await this.config.receiptRecorder.recordAllowlistChecked(
        payload.source,
        payload.eventType,
        allowlistResult.allowed,
        allowlistResult.reason,
        correlationId
      );
      
      if (!allowlistResult.allowed) {
        reply.status(403).send({
          error: 'NotAllowed',
          message: allowlistResult.reason,
        });
        return;
      }
      
      // Step 5: Idempotency check
      const idempotencyKey = generateIdempotencyKey(payload);
      const dedupResult = await this.config.deduplicationStore.check(idempotencyKey);
      
      if (dedupResult.isDuplicate && dedupResult.recommendation === 'skip') {
        await this.config.receiptRecorder.recordDuplicateDetected(
          idempotencyKey,
          dedupResult.entry?.eventId || 'unknown',
          correlationId
        );
        
        reply.status(200).send({
          status: 'duplicate',
          message: 'Event already processed',
          idempotencyKey,
        });
        return;
      }
      
      // Step 6: Normalize webhook
      const normalizedEvent = normalizeWebhook(payload);
      
      await this.config.receiptRecorder.record('webhook_normalized', {
        source: payload.source,
        originalType: payload.eventType,
        normalizedType: normalizedEvent.type,
      }, { correlationId });
      
      // Step 7: Record idempotency key
      await this.config.deduplicationStore.record({
        idempotencyKey,
        source: payload.source,
        eventType: payload.eventType,
        eventId: normalizedEvent.eventId,
      });
      
      // Step 8: Emit Rails events
      const externalEvent = await this.config.railsEmitter.emitExternalEvent(
        normalizedEvent,
        signatureVerified
      );
      
      await this.config.receiptRecorder.recordEventEmitted(
        externalEvent.type,
        externalEvent.eventId,
        correlationId
      );
      
      // Step 9: Create work request if needed
      if (requiresAgentAction(normalizedEvent)) {
        const config = inferWorkRequestConfig(normalizedEvent);
        
        const workRequest = await this.config.railsEmitter.emitWorkRequest(
          normalizedEvent,
          config.role,
          config.executionMode,
          config.priority
        );
        
        await this.config.receiptRecorder.recordWorkRequestCreated(
          workRequest.payload.requestId,
          config.role,
          correlationId
        );
      }
      
      // Step 10: Mark as processed
      await this.config.deduplicationStore.markProcessed(
        idempotencyKey,
        normalizedEvent.eventId
      );
      
      // Success response
      reply.status(200).send({
        status: 'accepted',
        eventId: normalizedEvent.eventId,
        idempotencyKey,
        correlationId,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.config.railsEmitter as unknown as { logger: { error: (msg: string, err?: unknown) => void } };
      
      reply.status(500).send({
        error: 'ProcessingError',
        message: errorMessage,
        correlationId,
      });
    }
  }
  
  /**
   * Validate source string
   */
  private isValidSource(source: string): boolean {
    const validSources = ['github', 'discord', 'antfarm', 'moltbook', 'custom'];
    return validSources.includes(source.toLowerCase());
  }
  
  /**
   * Parse webhook body into standard format
   */
  private parseWebhookBody(
    source: string,
    body: unknown,
    rawBody: string
  ): WebhookPayload {
    const timestamp = new Date().toISOString();
    
    // Basic payload structure
    const basePayload = {
      id: `wh_${Date.now()}`,
      source: source as WebhookSource,
      timestamp,
      rawPayload: body as Record<string, unknown>,
      rawPayload: body,
    };
    
    // Parse based on source
    switch (source) {
      case 'github':
        return this.parseGitHubPayload(body as Record<string, unknown>, basePayload);
      case 'discord':
        return this.parseDiscordPayload(body as Record<string, unknown>, basePayload);
      case 'antfarm':
        return this.parseAntFarmPayload(body as Record<string, unknown>, basePayload);
      case 'moltbook':
        return this.parseMoltbookPayload(body as Record<string, unknown>, basePayload);
      default:
        return {
          ...basePayload,
          eventType: 'custom.event',
          customData: body as Record<string, unknown>,
        };
    }
  }
  
  /**
   * Parse GitHub payload
   */
  private parseGitHubPayload(
    body: Record<string, unknown>,
    base: Record<string, unknown>
  ): WebhookPayload {
    const eventType = `${body.action || 'unknown'}.${body.sender ? 'event' : 'unknown'}`;
    
    return {
      ...base as WebhookPayload,
      eventType: body['x-github-event'] as string || 'push',
      repository: {
        fullName: (body.repository as Record<string, unknown>)?.full_name as string || '',
        name: (body.repository as Record<string, unknown>)?.name as string || '',
        owner: (body.repository as Record<string, unknown>)?.owner as string || '',
        url: (body.repository as Record<string, unknown>)?.html_url as string || '',
        private: Boolean((body.repository as Record<string, unknown>)?.private),
      },
      sender: body.sender ? {
        login: (body.sender as Record<string, unknown>)?.login as string,
        id: (body.sender as Record<string, unknown>)?.id as number,
        type: (body.sender as Record<string, unknown>)?.type as 'User' | 'Bot' | 'Organization',
      } : undefined,
    } as WebhookPayload;
  }
  
  /**
   * Parse Discord payload
   */
  private parseDiscordPayload(
    body: Record<string, unknown>,
    base: Record<string, unknown>
  ): WebhookPayload {
    return {
      ...base as WebhookPayload,
      eventType: 'message.create',
      guild: body.guild_id ? {
        id: String(body.guild_id),
        name: (body.guild_name as string) || 'Unknown',
      } : undefined,
      channel: body.channel_id ? {
        id: String(body.channel_id),
        name: (body.channel_name as string) || 'Unknown',
        type: 'text' as const,
      } : undefined,
      author: body.author ? {
        id: (body.author as Record<string, unknown>)?.id as string,
        username: (body.author as Record<string, unknown>)?.username as string,
        discriminator: (body.author as Record<string, unknown>)?.discriminator as string,
        bot: Boolean((body.author as Record<string, unknown>)?.bot),
      } : undefined,
      message: {
        id: body.id as string,
        content: body.content as string,
        timestamp: body.timestamp as string,
      },
    } as WebhookPayload;
  }
  
  /**
   * Parse Ant Farm payload
   */
  private parseAntFarmPayload(
    body: Record<string, unknown>,
    base: Record<string, unknown>
  ): WebhookPayload {
    return {
      ...base as WebhookPayload,
      eventType: body.type as string || 'room.message.created',
      room: body.room ? {
        id: (body.room as Record<string, unknown>)?.id as string,
        name: (body.room as Record<string, unknown>)?.name as string,
        type: (body.room as Record<string, unknown>)?.type as 'public' | 'private',
      } : undefined,
      message: body.message ? {
        id: (body.message as Record<string, unknown>)?.id as string,
        content: (body.message as Record<string, unknown>)?.content as string,
        author: (body.message as Record<string, unknown>)?.author as Record<string, unknown>,
        timestamp: (body.message as Record<string, unknown>)?.timestamp as string,
      } : undefined,
    } as WebhookPayload;
  }
  
  /**
   * Parse Moltbook payload
   */
  private parseMoltbookPayload(
    body: Record<string, unknown>,
    base: Record<string, unknown>
  ): WebhookPayload {
    return {
      ...base as WebhookPayload,
      eventType: body.type as string || 'post.created',
      post: body.post ? {
        id: (body.post as Record<string, unknown>)?.id as string,
        subject: (body.post as Record<string, unknown>)?.subject as string,
        content: (body.post as Record<string, unknown>)?.content as string,
        author: (body.post as Record<string, unknown>)?.author as Record<string, unknown>,
        timestamp: (body.post as Record<string, unknown>)?.timestamp as string,
      } : undefined,
    } as WebhookPayload;
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    const address = await this.fastify.listen({
      port: this.config.port,
      host: this.config.host,
    });
    
    console.log(`[WebhookServer] Listening on ${address}`);
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.fastify.close();
    this.config.rateLimiter.stop();
  }
  
  /**
   * Get Fastify instance (for testing)
   */
  getFastify(): FastifyInstance {
    return this.fastify;
  }
}

/**
 * Create default webhook server
 */
export function createWebhookServer(config?: Partial<WebhookServerConfig>): WebhookServer {
  const secrets = new Map<string, string>();
  
  // Load secrets from environment
  const githubSecret = process.env.WEBHOOK_GITHUB_SECRET;
  if (githubSecret) secrets.set('github', githubSecret);
  
  const discordSecret = process.env.WEBHOOK_DISCORD_SECRET;
  if (discordSecret) secrets.set('discord', discordSecret);
  
  return new WebhookServer({
    port: config?.port || 8787,
    host: config?.host || '0.0.0.0',
    corsOrigins: config?.corsOrigins || ['*'],
    secrets,
    allowlistValidator: createDefaultAllowlistValidator(),
    rateLimiter: createWebhookRateLimiter(),
    deduplicationStore: createDeduplicationStore({
      backend: 'memory',
      defaultTtlSeconds: 3600,
      cleanupIntervalSeconds: 300,
    }),
    railsEmitter: createRailsEventEmitter(),
    receiptRecorder: createReceiptRecorder(),
    logLevel: (config?.logLevel as 'debug' | 'info' | 'warn' | 'error') || 'info',
    ...config,
  });
}
