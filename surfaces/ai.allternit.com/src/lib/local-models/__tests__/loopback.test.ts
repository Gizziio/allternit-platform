import { describe, expect, it } from 'vitest';
import { assertLoopbackUrl, isLoopbackUrl } from '../loopback';
import { OllamaLocalProvider } from '../providers/ollama';

describe('isLoopbackUrl', () => {
  it.each([
    'http://127.0.0.1:11434',
    'http://127.0.0.2:8000',
    'http://127.255.255.254',
    'http://localhost:8000',
    'http://foo.localhost:3000',
    'http://[::1]:8000',
    'https://127.0.0.1',
  ])('accepts %s', (url) => {
    expect(isLoopbackUrl(url)).toBe(true);
  });

  it.each([
    'http://5.189.170.23:11434',
    'https://api.openai.com/v1',
    'http://192.168.1.10:11434',
    'http://0.0.0.0:8000',
    'ftp://127.0.0.1',
    'not-a-url',
    'http://',
  ])('rejects %s', (url) => {
    expect(isLoopbackUrl(url)).toBe(false);
  });
});

describe('assertLoopbackUrl', () => {
  it('returns the URL when loopback', () => {
    expect(assertLoopbackUrl('http://127.0.0.1:11434', 'Ollama')).toBe('http://127.0.0.1:11434');
  });

  it('throws a clear error for remote hosts', () => {
    expect(() => assertLoopbackUrl('http://5.189.170.23:11434', 'Ollama')).toThrow(/loopback/);
  });
});

describe('OllamaLocalProvider loopback enforcement', () => {
  it('rejects a remote endpoint by default', () => {
    expect(() => new OllamaLocalProvider({ baseUrl: 'http://5.189.170.23:11434' })).toThrow(
      /loopback/,
    );
  });

  it('accepts a remote endpoint only with explicit opt-in', () => {
    expect(
      () => new OllamaLocalProvider({ baseUrl: 'http://5.189.170.23:11434', allowRemote: true }),
    ).not.toThrow();
  });

  it('defaults to the loopback endpoint', () => {
    expect(() => new OllamaLocalProvider()).not.toThrow();
  });
});
