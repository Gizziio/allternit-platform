import { describe, it, expect } from 'bun:test';
import { AllternitHarness } from '../harness';
import { injectSystemPrompt, ALLTERNIT_SYSTEM_PROMPT } from '../harness/prompts';
import type { Message } from '../harness/types';

describe('AllternitHarness', () => {
  describe('Constructor', () => {
    it('should create BYOK harness', () => {
      const harness = new AllternitHarness({
        mode: 'byok',
        byok: { anthropic: { apiKey: 'test' } }
      });
      expect(harness).toBeDefined();
    });
    
    it('should create Cloud harness', () => {
      const harness = new AllternitHarness({
        mode: 'cloud',
        cloud: { baseURL: 'https://api.allternit.com', accessToken: 'test' }
      });
      expect(harness).toBeDefined();
    });
    
    it('should create Local harness', () => {
      const harness = new AllternitHarness({
        mode: 'local',
        local: { baseURL: 'http://localhost:11434' }
      });
      expect(harness).toBeDefined();
    });
  });
  
  describe('System Prompt Injection', () => {
    it('should inject system prompt when none exists', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const result = injectSystemPrompt(messages);
      
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe(ALLTERNIT_SYSTEM_PROMPT);
      expect(result[1]).toEqual(messages[0]);
    });
    
    it('should augment existing system prompt', () => {
      const messages: Message[] = [
        { role: 'system', content: 'Custom prompt' },
        { role: 'user', content: 'Hello' }
      ];
      const result = injectSystemPrompt(messages);
      
      expect(result[0].role).toBe('system');
      expect(result[0].content).toContain('Allternit');
      expect(result[0].content).toContain('Custom prompt');
    });
  });
});
