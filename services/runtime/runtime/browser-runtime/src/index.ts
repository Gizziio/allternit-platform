import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import { BrowserManager } from './browser.js';
import {
  CreateSessionRequest,
  NavigateRequest,
  ClickRequest,
  TypeRequest,
  ScrollRequest,
  InputRequest,
  InputEventType,
} from './types.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const browserManager = new BrowserManager({
  headless: true,
  viewport: { width: 1280, height: 720 },
  timeout: 30000,
});

const wsConnections = new Map<string, Set<WebSocket>>();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sessions: browserManager.getActiveSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/session', async (req: express.Request, res: express.Response) => {
  try {
    const { url, width, height } = req.body as CreateSessionRequest;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const config = width && height
      ? { viewport: { width, height } }
      : {};

    await browserManager.createSession(sessionId, url || 'about:blank');

    res.json({ sessionId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/session/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    await browserManager.closeSession(id);

    const connections = wsConnections.get(id);
    if (connections) {
      connections.forEach((ws) => ws.close());
      wsConnections.delete(id);
    }

    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/navigate', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { url, waitUntil = 'domcontentloaded' } = req.body as NavigateRequest;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    const currentUrl = await browserManager.navigate(id, url, waitUntil);
    res.json({ url: currentUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/click', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { selector, x, y, button = 'left' } = req.body as ClickRequest;

    // Support both selector-based and coordinate-based clicks
    if (selector) {
      await browserManager.click(id, selector, button);
    } else if (typeof x === 'number' && typeof y === 'number') {
      await browserManager.clickAt(id, x, y, button);
    } else {
      // Default: click at center
      await browserManager.click(id, undefined, button);
    }
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/type', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { text, selector } = req.body as TypeRequest;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    await browserManager.type(id, text, selector);
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/scroll', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { deltaX = 0, deltaY = 0 } = req.body as ScrollRequest;

    await browserManager.scroll(id, deltaX, deltaY);
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UNIFIED INPUT ENDPOINT (Gold Standard)
// Handles all input types: mouse, keyboard, wheel
// ============================================
app.post('/session/:id/input', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const input = req.body as InputRequest;

    if (!input.type) {
      res.status(400).json({ error: 'Input type is required' });
      return;
    }

    const session = browserManager.getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { page } = session;

    switch (input.type as InputEventType) {
      case 'mousemove':
        if (typeof input.x === 'number' && typeof input.y === 'number') {
          await page.mouse.move(input.x, input.y);
        }
        break;

      case 'mousedown':
        if (typeof input.x === 'number' && typeof input.y === 'number') {
          await page.mouse.click(input.x, input.y, {
            button: input.button as any || 'left',
          });
        } else {
          await page.mouse.down();
        }
        break;

      case 'mouseup':
        await page.mouse.up();
        break;

      case 'wheel':
        await page.mouse.wheel(input.deltaX || 0, input.deltaY || 0);
        break;

      case 'keydown':
        if (input.key) {
          await page.keyboard.down(input.key);
        }
        break;

      case 'keyup':
        if (input.key) {
          await page.keyboard.up(input.key);
        }
        break;

      case 'text':
        if (input.text) {
          await page.keyboard.type(input.text);
        }
        break;

      default:
        res.status(400).json({ error: `Unknown input type: ${input.type}` });
        return;
    }

    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PERFORMANCE METRICS ENDPOINT
// ============================================
app.get('/session/:id/metrics', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const session = browserManager.getSession(id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get performance metrics from the page
    const metrics = await session.page.evaluate(() => {
      const timing = performance.timing;
      const navigationStart = timing.navigationStart;

      return {
        // Page load metrics
        pageLoadTime: timing.loadEventEnd - navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
        domInteractive: timing.domInteractive - navigationStart,

        // Memory (if available)
        memoryUsedJSHeap: (performance as any).memory?.usedJSHeapSize,
        memoryTotalJSHeap: (performance as any).memory?.totalJSHeapSize,

        // Navigation
        url: window.location.href,
        title: document.title,
      };
    });

    res.json({
      sessionId: id,
      ...metrics,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CURRENT URL ENDPOINT
// ============================================

app.get('/session/:id/screenshot', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as 'png' | 'jpeg') || 'png';

    const screenshot = await browserManager.screenshot(id, format);

    res.set('Content-Type', `image/${format}`);
    res.set('Content-Length', screenshot.length.toString());
    res.send(screenshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/session/:id/dom', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const dom = await browserManager.getDOM(id);
    res.json(dom);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/session/:id/url', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const url = await browserManager.getCurrentURL(id);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/back', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    await browserManager.goBack(id);
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/forward', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    await browserManager.goForward(id);
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/reload', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    await browserManager.reload(id);
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(4001, 'Session ID required');
    return;
  }

  if (!wsConnections.has(sessionId)) {
    wsConnections.set(sessionId, new Set());
  }
  wsConnections.get(sessionId)!.add(ws);

  console.log(`WebSocket connected for session: ${sessionId}`);

  const unsubscribe = browserManager.subscribeToEvents(sessionId, (event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        case 'click':
          if (typeof message.x === 'number' && typeof message.y === 'number') {
            browserManager.clickAt(sessionId, message.x, message.y, message.button);
          } else {
            browserManager.click(sessionId, message.selector, message.button);
          }
          break;
        case 'mousemove':
          browserManager.scroll(sessionId, message.deltaX || 0, message.deltaY || 0);
          break;
        case 'scroll':
          browserManager.scroll(sessionId, message.deltaX || 0, message.deltaY || 0);
          break;
        case 'type':
          browserManager.type(sessionId, message.text, message.selector);
          break;
        case 'keypress':
          browserManager.type(sessionId, message.key);
          break;
        case 'goto':
          browserManager.navigate(sessionId, message.url);
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket closed for session: ${sessionId}`);
    unsubscribe();
    const connections = wsConnections.get(sessionId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        wsConnections.delete(sessionId);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error.message);
  });
});

const PORT = process.env.PORT || 8003;
const HOST = process.env.HOST || "127.0.0.1";

server.listen(PORT, HOST, () => {
  console.log(`Browser Runtime Service running on http://${HOST}:${PORT}`);
  console.log(`Health check: GET http://${HOST}:${PORT}/health`);
  console.log(`WebSocket: ws://${HOST}:${PORT}/ws?sessionId=<id>`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down browser runtime service...');
  await browserManager.closeAll();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('Interrupted, shutting down...');
  await browserManager.closeAll();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
