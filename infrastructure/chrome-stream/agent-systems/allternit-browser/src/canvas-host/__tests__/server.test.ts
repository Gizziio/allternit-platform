/**
 * Canvas Host Server Tests
 * 
 * Tests for the canvas hosting server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startCanvasHost, createCanvasHostHandler } from '../server.js';
import { handleA2uiHttpRequest, injectCanvasLiveReload } from '../a2ui.js';

describe('Canvas Host', () => {
  let canvasHost: { port: number; rootDir: string; close: () => Promise<void> };

  beforeAll(async () => {
    canvasHost = await startCanvasHost({
      port: 0, // Use any available port
      liveReload: false, // Disable for testing
    });
  });

  afterAll(async () => {
    await canvasHost.close();
  });

  it('should start canvas host server', () => {
    expect(canvasHost).toBeDefined();
    expect(canvasHost.port).toBeGreaterThan(0);
    expect(canvasHost.rootDir).toBeDefined();
  });

  it('should serve index.html', async () => {
    const response = await fetch(`http://127.0.0.1:${canvasHost.port}/`);
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('Allternit Canvas');
  });

  it('should return 404 for missing files', async () => {
    const response = await fetch(`http://127.0.0.1:${canvasHost.port}/nonexistent-file.txt`);
    expect(response.status).toBe(404);
  });
});

describe('A2UI Handler', () => {
  it('should export A2UI handling functions', () => {
    expect(handleA2uiHttpRequest).toBeDefined();
    expect(injectCanvasLiveReload).toBeDefined();
    expect(typeof handleA2uiHttpRequest).toBe('function');
    expect(typeof injectCanvasLiveReload).toBe('function');
  });

  it('should inject live reload script', () => {
    const html = '<html><body>Test</body></html>';
    const result = injectCanvasLiveReload(html);
    
    expect(result).toContain('Allternit');
    expect(result).toContain('allternitSendUserAction');
    expect(result).toContain('WebSocket');
  });

  it('should handle HTML without body tag gracefully', () => {
    const html = '<html>Test</html>';
    const result = injectCanvasLiveReload(html);
    
    expect(result).toContain('Allternit');
    expect(result.length).toBeGreaterThan(html.length);
  });
});

describe('Canvas Host Handler', () => {
  it('should create handler with default options', async () => {
    const handler = await createCanvasHostHandler({
      liveReload: false,
    });

    expect(handler).toBeDefined();
    expect(handler.rootDir).toBeDefined();
    expect(handler.basePath).toBe('/__allternit__/canvas');
    expect(typeof handler.handleHttpRequest).toBe('function');
    expect(typeof handler.handleUpgrade).toBe('function');
    expect(typeof handler.close).toBe('function');

    await handler.close();
  });

  it('should handle HTTP requests', async () => {
    const handler = await createCanvasHostHandler({
      liveReload: false,
    });

    // Create mock request/response
    const mockReq = {
      url: '/',
      method: 'GET',
      headers: {},
    };

    const mockRes = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: undefined as any,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end(data: any) {
        this.body = data;
      },
    };

    const handled = await handler.handleHttpRequest(mockReq as any, mockRes as any);
    expect(handled).toBe(true);
    expect(mockRes.statusCode).toBe(200);

    await handler.close();
  });
});
