import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store connected clients
const clients = new Set<WebSocket>();

// Broadcast event to all connected clients
function broadcastEvent(event: any) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  console.log('New AGUI client connected');
  clients.add(ws);

  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message from AGUI client:', message);
      
      // Process the message based on its type
      switch (message.type) {
        case 'subscribe':
          // Client wants to subscribe to certain events
          console.log(`Client subscribed to: ${message.channels?.join(', ') || 'all events'}`);
          break;
          
        case 'unsubscribe':
          // Client wants to unsubscribe from certain events
          console.log(`Client unsubscribed from: ${message.channels?.join(', ') || 'all events'}`);
          break;
          
        case 'event':
          // Client is sending an event to be broadcast
          broadcastEvent(message.payload);
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('AGUI client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'Connected to AGUI Gateway',
    timestamp: new Date().toISOString()
  }));
});

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connectedClients: clients.size, timestamp: new Date().toISOString() });
});

app.get('/events', (req, res) => {
  res.json({ 
    message: 'Event streaming endpoint. Connect via WebSocket for real-time updates.',
    timestamp: new Date().toISOString()
  });
});

app.post('/broadcast', (req, res) => {
  const { event, target } = req.body;
  
  if (!event) {
    return res.status(400).json({ error: 'Event payload is required' });
  }
  
  // Broadcast the event to all clients or specific target
  if (target) {
    // In a real implementation, you might want to send to specific client
    broadcastEvent({ ...event, target });
  } else {
    broadcastEvent(event);
  }
  
  res.json({ success: true, message: 'Event broadcasted', event });
});

const PORT = process.env.PORT || 8010;
const HOST = process.env.HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`AGUI Gateway running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server listening for connections`);
  console.log(`Health check: GET /health`);
  console.log(`Broadcast event: POST /broadcast`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down AGUI Gateway...');
  
  // Close all WebSocket connections
  clients.forEach(client => {
    client.close(1000, 'Server shutting down');
  });
  
  server.close(() => {
    console.log('AGUI Gateway closed');
  });
});
