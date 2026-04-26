/**
 * Full Integration Test
 * Tests the complete SDK functionality including all providers and ACP
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  // Core
  AllternitHarness,
  ALLTERNIT_SYSTEM_PROMPT,
  injectSystemPrompt,
  VERSION,
  
  // Providers
  AllternitAI,
  AllternitOpenAI,
  AllternitGoogleAI,
  AllternitOllama,
  AllternitMistral,
  AllternitCohere,
  AllternitGroq,
  AllternitTogether,
  AllternitAzure,
  AllternitBedrock,
  
  // Registry
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  getProvider,
  findProvidersByFeature,
  
  // ACP
  acpRegistry,
  ACPRegistry,
  ACPMessageSchema,
  ACPToolSchema,
  ACPSessionSchema,
  ACPRegistryEntrySchema,
  validateMessage,
  validateTool,
  validateSession,
  validateRegistryEntry,
  ACPHarnessBridge,
} from '../index.js';

describe('Full SDK Integration', () => {
  describe('Core Exports', () => {
    it('should export VERSION', () => {
      expect(VERSION).toBe('1.0.0');
    });

    it('should export AllternitHarness', () => {
      expect(AllternitHarness).toBeDefined();
      expect(typeof AllternitHarness).toBe('function');
    });

    it('should export system prompt utilities', () => {
      expect(ALLTERNIT_SYSTEM_PROMPT).toBeDefined();
      expect(typeof ALLTERNIT_SYSTEM_PROMPT).toBe('string');
      expect(typeof injectSystemPrompt).toBe('function');
    });
  });

  describe('Provider Exports', () => {
    it('should export all 10 providers', () => {
      expect(AllternitAI).toBeDefined();
      expect(AllternitOpenAI).toBeDefined();
      expect(AllternitGoogleAI).toBeDefined();
      expect(AllternitOllama).toBeDefined();
      expect(AllternitMistral).toBeDefined();
      expect(AllternitCohere).toBeDefined();
      expect(AllternitGroq).toBeDefined();
      expect(AllternitTogether).toBeDefined();
      expect(AllternitAzure).toBeDefined();
      expect(AllternitBedrock).toBeDefined();
    });

    it('should have working provider constructors', () => {
      // Anthropic
      expect(() => new AllternitAI({ apiKey: 'test' })).not.toThrow();
      
      // OpenAI
      expect(() => new AllternitOpenAI({ apiKey: 'test' })).not.toThrow();
      
      // Google
      expect(() => new AllternitGoogleAI({ apiKey: 'test' })).not.toThrow();
      
      // Ollama
      expect(() => new AllternitOllama({ baseURL: 'http://localhost:11434' })).not.toThrow();
      
      // Mistral
      expect(() => new AllternitMistral({ apiKey: 'test' })).not.toThrow();
      
      // Cohere
      expect(() => new AllternitCohere({ apiKey: 'test' })).not.toThrow();
      
      // Groq
      expect(() => new AllternitGroq({ apiKey: 'test' })).not.toThrow();
      
      // Together
      expect(() => new AllternitTogether({ apiKey: 'test' })).not.toThrow();
      
      // Azure
      expect(() => new AllternitAzure({ 
        apiKey: 'test', 
        endpoint: 'https://test.openai.azure.com',
        deploymentId: 'test'
      })).not.toThrow();
      
      // Bedrock
      expect(() => new AllternitBedrock({ 
        region: 'us-east-1', 
        accessKeyId: 'test',
        secretAccessKey: 'test'
      })).not.toThrow();
    });
  });

  describe('Provider Registry', () => {
    it('should have all providers in registry', () => {
      const providers = listProviders();
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('ollama');
      expect(providers).toContain('mistral');
      expect(providers).toContain('cohere');
      expect(providers).toContain('groq');
      expect(providers).toContain('together');
      expect(providers).toContain('azure');
      expect(providers).toContain('bedrock');
      expect(providers).toHaveLength(10);
    });

    it('should retrieve provider metadata', () => {
      const anthropicMeta = getProvider('anthropic');
      expect(anthropicMeta).toBeDefined();
      expect(anthropicMeta?.name).toBe('anthropic');
      expect(anthropicMeta?.displayName).toBe('Anthropic Claude');
      expect(anthropicMeta?.supportsStreaming).toBe(true);
    });

    it('should find providers by feature', () => {
      const streamingProviders = findProvidersByFeature('streaming');
      expect(streamingProviders.length).toBeGreaterThan(0);
      
      const visionProviders = findProvidersByFeature('vision');
      expect(visionProviders.some(p => p.name === 'anthropic')).toBe(true);
    });

    it('should create providers via factory', () => {
      const provider = createProvider('ollama', { baseURL: 'http://localhost:11434' });
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(AllternitOllama);
    });

    it('should throw for unknown provider', () => {
      expect(() => createProvider('unknown', {})).toThrow('Provider "unknown" not found');
    });
  });

  describe('ACP Module', () => {
    describe('Schemas', () => {
      it('should export ACPMessageSchema', () => {
        expect(ACPMessageSchema).toBeDefined();
        expect(typeof ACPMessageSchema.parse).toBe('function');
      });

      it('should export ACPToolSchema', () => {
        expect(ACPToolSchema).toBeDefined();
      });

      it('should export ACPSessionSchema', () => {
        expect(ACPSessionSchema).toBeDefined();
      });

      it('should export ACPRegistryEntrySchema', () => {
        expect(ACPRegistryEntrySchema).toBeDefined();
      });
    });

    describe('Registry', () => {
      it('should export global acpRegistry', () => {
        expect(acpRegistry).toBeDefined();
        expect(acpRegistry).toBeInstanceOf(ACPRegistry);
      });

      it('should be able to create new registry instance', () => {
        const registry = new ACPRegistry();
        expect(registry).toBeInstanceOf(ACPRegistry);
        registry.dispose();
      });

      it('should register and retrieve agents', () => {
        const registry = new ACPRegistry();
        const agentId = 'test-agent-' + Date.now();
        
        registry.register({
          agentId,
          name: 'Test Agent',
          description: 'A test agent',
          version: '1.0.0',
          capabilities: [],
          endpoints: {},
          authentication: { type: 'none' },
          metadata: {
            tags: ['test'],
            category: 'test',
            author: 'test',
            license: 'MIT',
          },
          status: 'active',
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        });

        const retrieved = registry.get(agentId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('Test Agent');

        registry.dispose();
      });
    });

    describe('Validators', () => {
      it('should validate ACP messages', () => {
        const validMessage = {
          id: crypto.randomUUID(),
          version: '1.0' as const,
          timestamp: new Date().toISOString(),
          source: { agentId: 'test', capability: 'test' },
          target: { agentId: 'test2' },
          type: 'request' as const,
          payload: { action: 'test' },
        };

        const result = validateMessage(validMessage);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
      });

      it('should reject invalid messages', () => {
        const invalidMessage = {
          id: 'not-a-uuid',
          version: '1.0',
          timestamp: 'invalid-date',
          source: {},
          target: {},
          type: 'unknown',
          payload: {},
        };

        const result = validateMessage(invalidMessage);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      });

      it('should validate ACP tools', () => {
        const validTool = {
          name: 'test-tool',
          description: 'A test tool',
          version: '1.0.0',
          parameters: {
            type: 'object' as const,
            properties: {},
          },
          returns: {
            type: 'string' as const,
            description: 'Result',
          },
        };

        const result = validateTool(validTool);
        expect(result.valid).toBe(true);
      });

      it('should validate ACP sessions', () => {
        const validSession = {
          id: crypto.randomUUID(),
          agentId: 'test',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          capabilities: ['test'],
          permissions: ['read' as const],
          metrics: {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastActivity: new Date().toISOString(),
          },
        };

        const result = validateSession(validSession);
        expect(result.valid).toBe(true);
      });

      it('should validate registry entries', () => {
        const validEntry = {
          agentId: 'test',
          name: 'Test',
          description: 'A test',
          version: '1.0.0',
          capabilities: [],
          endpoints: {},
          authentication: { type: 'none' as const },
          metadata: {
            tags: [],
            category: 'test',
            author: 'test',
            license: 'MIT',
          },
          status: 'active' as const,
          registeredAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        };

        const result = validateRegistryEntry(validEntry);
        expect(result.valid).toBe(true);
      });
    });

    describe('Harness Bridge', () => {
      it('should export ACPHarnessBridge', () => {
        expect(ACPHarnessBridge).toBeDefined();
        expect(typeof ACPHarnessBridge).toBe('function');
      });

      it('should create bridge instance', () => {
        const harness = new AllternitHarness({
          mode: 'local',
          local: { baseURL: 'http://localhost:11434' }
        });

        const bridge = new ACPHarnessBridge({
          harness,
          agentId: 'test-bridge',
          capabilities: ['chat'],
        });

        expect(bridge).toBeInstanceOf(ACPHarnessBridge);
      });

      it('should provide bridge stats', () => {
        const harness = new AllternitHarness({
          mode: 'local',
          local: { baseURL: 'http://localhost:11434' }
        });

        const bridge = new ACPHarnessBridge({
          harness,
          agentId: 'test-bridge-stats',
          capabilities: ['chat', 'stream'],
        });

        const stats = bridge.getStats();
        expect(stats.agentId).toBe('test-bridge-stats');
        expect(stats.capabilities).toContain('chat');
        expect(stats.capabilities).toContain('stream');
      });
    });
  });

  describe('End-to-End Integration', () => {
    it('should create harness with provider registry', () => {
      const providers = listProviders();
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: {
          anthropic: { apiKey: 'test-key' },
        }
      });

      expect(harness).toBeDefined();
      expect(providers.length).toBe(10);
    });

    it('should integrate ACP with harness', async () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434' }
      });

      const bridge = new ACPHarnessBridge({
        harness,
        agentId: 'integration-test-agent',
        capabilities: ['chat'],
      });

      // Register the agent
      bridge.register();

      // Verify registration
      const stats = bridge.getStats();
      expect(stats.registered).toBe(true);

      // Cleanup
      bridge.unregister();
    });

    it('should process valid ACP messages', async () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434' }
      });

      const bridge = new ACPHarnessBridge({
        harness,
        agentId: 'message-test-agent',
        capabilities: ['chat'],
      });

      const handshakeMessage = {
        id: crypto.randomUUID(),
        version: '1.0' as const,
        timestamp: new Date().toISOString(),
        source: { agentId: 'external-agent', capability: 'test' },
        target: { agentId: 'message-test-agent' },
        type: 'handshake' as const,
        payload: { action: 'handshake' },
      };

      const response = await bridge.processMessage(handshakeMessage);
      expect(response).toBeDefined();
      expect(response?.type).toBe('response');
    });
  });
});
