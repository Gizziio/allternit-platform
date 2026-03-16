import express from 'express';
import http from 'http';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// In-memory storage for agents and services
const agents: Map<string, any> = new Map();
const services: Map<string, any> = new Map();
const connections: Map<string, any> = new Map();

// Agent registration
app.post('/register/agent', (req, res) => {
  const { id, name, capabilities, endpoint } = req.body;
  
  if (!id || !name || !endpoint) {
    return res.status(400).json({ error: 'Missing required fields: id, name, endpoint' });
  }
  
  const agent = {
    id,
    name,
    capabilities: capabilities || [],
    endpoint,
    registeredAt: new Date().toISOString(),
    status: 'online'
  };
  
  agents.set(id, agent);
  
  res.json({ 
    success: true, 
    message: `Agent ${name} registered successfully`,
    agent 
  });
});

// Service registration
app.post('/register/service', (req, res) => {
  const { id, name, type, endpoint } = req.body;
  
  if (!id || !name || !type || !endpoint) {
    return res.status(400).json({ error: 'Missing required fields: id, name, type, endpoint' });
  }
  
  const service = {
    id,
    name,
    type,
    endpoint,
    registeredAt: new Date().toISOString(),
    status: 'available'
  };
  
  services.set(id, service);
  
  res.json({ 
    success: true, 
    message: `Service ${name} registered successfully`,
    service 
  });
});

// Discover agents
app.get('/discover/agents', (req, res) => {
  const query = req.query.capability as string;
  
  let results = Array.from(agents.values());
  
  if (query) {
    results = results.filter(agent => 
      agent.capabilities && agent.capabilities.includes(query)
    );
  }
  
  res.json({ 
    count: results.length,
    agents: results 
  });
});

// Discover services
app.get('/discover/services', (req, res) => {
  const type = req.query.type as string;
  
  let results = Array.from(services.values());
  
  if (type) {
    results = results.filter(service => service.type === type);
  }
  
  res.json({ 
    count: results.length,
    services: results 
  });
});

// Establish connection between agents
app.post('/connect', (req, res) => {
  const { sourceAgentId, targetAgentId, purpose } = req.body;
  
  if (!sourceAgentId || !targetAgentId) {
    return res.status(400).json({ error: 'Both sourceAgentId and targetAgentId are required' });
  }
  
  const sourceAgent = agents.get(sourceAgentId);
  const targetAgent = agents.get(targetAgentId);
  
  if (!sourceAgent) {
    return res.status(404).json({ error: `Source agent ${sourceAgentId} not found` });
  }
  
  if (!targetAgent) {
    return res.status(404).json({ error: `Target agent ${targetAgentId} not found` });
  }
  
  // Create a connection record
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const connection = {
    id: connectionId,
    sourceAgentId,
    targetAgentId,
    purpose: purpose || 'general',
    establishedAt: new Date().toISOString(),
    status: 'active'
  };
  
  connections.set(connectionId, connection);
  
  res.json({ 
    success: true, 
    message: `Connection established between ${sourceAgent.name} and ${targetAgent.name}`,
    connection 
  });
});

// Get connection details
app.get('/connection/:id', (req, res) => {
  const { id } = req.params;
  const connection = connections.get(id);
  
  if (!connection) {
    return res.status(404).json({ error: `Connection ${id} not found` });
  }
  
  res.json({ connection });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stats: {
      registeredAgents: agents.size,
      registeredServices: services.size,
      activeConnections: connections.size
    }
  });
});

// Ping endpoint for agents to update status
app.post('/ping/:agentId', (req, res) => {
  const { agentId } = req.params;
  const agent = agents.get(agentId);
  
  if (!agent) {
    return res.status(404).json({ error: `Agent ${agentId} not found` });
  }
  
  // Update last seen timestamp
  agent.lastSeen = new Date().toISOString();
  agent.status = 'online';
  
  res.json({ 
    success: true, 
    message: `Ping received from agent ${agent.name}`,
    timestamp: agent.lastSeen
  });
});

const PORT = process.env.PORT || 8012;
const HOST = process.env.HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`A2A Gateway running on http://${HOST}:${PORT}`);
  console.log(`Register agent: POST /register/agent`);
  console.log(`Discover agents: GET /discover/agents`);
  console.log(`Register service: POST /register/service`);
  console.log(`Discover services: GET /discover/services`);
  console.log(`Connect agents: POST /connect`);
  console.log(`Health check: GET /health`);
});

// Periodically clean up inactive agents
setInterval(() => {
  const now = Date.now();
  const timeout = 30000; // 30 seconds
  
  agents.forEach((agent, id) => {
    if (agent.lastSeen) {
      const lastSeen = new Date(agent.lastSeen).getTime();
      if (now - lastSeen > timeout) {
        agent.status = 'offline';
        console.log(`Marked agent ${agent.name} as offline`);
      }
    }
  });
}, 10000); // Check every 10 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down A2A Gateway...');
  server.close(() => {
    console.log('A2A Gateway closed');
  });
});
