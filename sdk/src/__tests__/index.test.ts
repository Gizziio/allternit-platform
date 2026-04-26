import { describe, it, expect } from 'bun:test';

// Test SDK exports
describe('SDK Exports', () => {
  it('should export AllternitHarness from main index', async () => {
    const { AllternitHarness } = await import('../index');
    expect(AllternitHarness).toBeDefined();
    expect(typeof AllternitHarness).toBe('function');
  });

  it('should export AllternitAI (Anthropic) from main index', async () => {
    const { AllternitAI } = await import('../index');
    expect(AllternitAI).toBeDefined();
    expect(typeof AllternitAI).toBe('function');
  });

  it('should export AllternitOpenAI from main index', async () => {
    const { AllternitOpenAI } = await import('../index');
    expect(AllternitOpenAI).toBeDefined();
    expect(typeof AllternitOpenAI).toBe('function');
  });

  it('should export AllternitGoogleAI from main index', async () => {
    const { AllternitGoogleAI } = await import('../index');
    expect(AllternitGoogleAI).toBeDefined();
    expect(typeof AllternitGoogleAI).toBe('function');
  });

  it('should export AllternitOllama from main index', async () => {
    const { AllternitOllama } = await import('../index');
    expect(AllternitOllama).toBeDefined();
    expect(typeof AllternitOllama).toBe('function');
  });

  it('should export types from main index', async () => {
    const types = await import('../index');
    
    // Type exports should be available (they exist at compile time)
    expect(types).toBeDefined();
  });
});

// Test harness exports
describe('Harness Exports', () => {
  it('should export AllternitHarness from harness module', async () => {
    const { AllternitHarness } = await import('../harness');
    expect(AllternitHarness).toBeDefined();
  });

  it('should export prompt functions from harness module', async () => {
    const { injectSystemPrompt, injectProviderPrompt, validateMessages } = await import('../harness');
    expect(injectSystemPrompt).toBeDefined();
    expect(injectProviderPrompt).toBeDefined();
    expect(validateMessages).toBeDefined();
  });

  it('should export types from harness module', async () => {
    const { HarnessError, HarnessErrorCode } = await import('../harness');
    expect(HarnessError).toBeDefined();
    expect(HarnessErrorCode).toBeDefined();
  });
});

// Test provider exports
describe('Provider Exports', () => {
  it('should export AllternitAI from anthropic module', async () => {
    const { AllternitAI } = await import('../providers/anthropic');
    expect(AllternitAI).toBeDefined();
  });

  it('should export AllternitOpenAI from openai module', async () => {
    const { AllternitOpenAI } = await import('../providers/openai');
    expect(AllternitOpenAI).toBeDefined();
  });

  it('should export AllternitGoogleAI from google module', async () => {
    const { AllternitGoogleAI } = await import('../providers/google');
    expect(AllternitGoogleAI).toBeDefined();
  });

  it('should export AllternitOllama from ollama module', async () => {
    const { AllternitOllama } = await import('../providers/ollama');
    expect(AllternitOllama).toBeDefined();
  });
});

// Test types
describe('Type Definitions', () => {
  it('should have HarnessError with code property', async () => {
    const { HarnessError, HarnessErrorCode } = await import('../harness');
    
    const error = new HarnessError(
      HarnessErrorCode.CONFIG_INVALID,
      'Test error'
    );
    
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(HarnessErrorCode.CONFIG_INVALID);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('HarnessError');
  });

  it('should have HarnessError with cause', async () => {
    const { HarnessError, HarnessErrorCode } = await import('../harness');
    
    const cause = new Error('Original error');
    const error = new HarnessError(
      HarnessErrorCode.API_ERROR,
      'Wrapped error',
      cause
    );
    
    expect(error.cause).toBe(cause);
  });
});
