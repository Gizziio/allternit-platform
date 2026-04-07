#!/usr/bin/env node
/**
 * A2R Rails API Server
 * 
 * Implements endpoints for:
 * - Agents
 * - Providers  
 * - Sessions
 * - Rails (WIHs)
 * - Gateway Tools
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.RAILS_API_PORT || process.env.PORT || 3002;
const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
}));
app.use(express.json());

// In-memory stores (replace with database in production)
const agents = new Map();
const sessions = new Map();
const providers = new Map([
  ['openai', { 
    id: 'openai', 
    name: 'OpenAI', 
    enabled: true,
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    auth_status: 'connected'
  }],
  ['anthropic', { 
    id: 'anthropic', 
    name: 'Anthropic', 
    enabled: true,
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    auth_status: 'connected'
  }],
  ['google', { 
    id: 'google', 
    name: 'Google', 
    enabled: false,
    models: ['gemini-pro', 'gemini-ultra'],
    auth_status: 'disconnected'
  }]
]);
const wihs = new Map(); // Work Inbox Items

// ============================================================================
// Health Check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rails-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Providers API
// ============================================================================
app.get('/api/v1/providers', (req, res) => {
  const providerList = Array.from(providers.values()).map(p => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    models: p.models
  }));
  res.json({ providers: providerList });
});

app.get('/api/v1/providers/auth/status', (req, res) => {
  const status = Array.from(providers.values()).map(p => ({
    provider_id: p.id,
    status: p.auth_status,
    last_checked: new Date().toISOString()
  }));
  res.json({ providers: status });
});

// ============================================================================
// Agents API
// ============================================================================
app.get('/api/v1/agents', (req, res) => {
  const agentList = Array.from(agents.values()).map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    capabilities: a.capabilities || [],
    created_at: a.created_at
  }));
  res.json({ agents: agentList });
});

app.post('/api/v1/agents', (req, res) => {
  const { name, capabilities = [] } = req.body;
  const agent = {
    id: uuidv4(),
    name: name || `Agent-${agents.size + 1}`,
    status: 'idle',
    capabilities,
    created_at: new Date().toISOString()
  };
  agents.set(agent.id, agent);
  res.status(201).json(agent);
});

app.get('/api/v1/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

// ============================================================================
// Agent Sessions API
// ============================================================================
app.get('/api/v1/agent-sessions', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    id: s.id,
    agent_id: s.agent_id,
    status: s.status,
    created_at: s.created_at,
    updated_at: s.updated_at
  }));
  res.json({ sessions: sessionList });
});

app.post('/api/v1/agent-sessions', (req, res) => {
  const { agent_id } = req.body;
  const session = {
    id: uuidv4(),
    agent_id: agent_id || null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  sessions.set(session.id, session);
  res.status(201).json(session);
});

// ============================================================================
// Rails WIHs (Work Inbox Items) API
// ============================================================================
app.get('/api/rails/wihs', (req, res) => {
  const wihList = Array.from(wihs.values()).map(w => ({
    id: w.id,
    type: w.type,
    title: w.title,
    status: w.status,
    priority: w.priority,
    created_at: w.created_at
  }));
  res.json({ wihs: wihList });
});

app.post('/api/rails/wihs', (req, res) => {
  const { type, title, priority = 'medium' } = req.body;
  const wih = {
    id: uuidv4(),
    type: type || 'task',
    title: title || 'New Work Item',
    status: 'pending',
    priority,
    created_at: new Date().toISOString()
  };
  wihs.set(wih.id, wih);
  res.status(201).json(wih);
});

// ============================================================================
// Gateway Tools API
// ============================================================================
app.post('/api/v1/gateway/tool', (req, res) => {
  const { tool, params } = req.body;
  
  // Mock tool execution
  const result = {
    success: true,
    tool: tool || 'unknown',
    result: {
      executed_at: new Date().toISOString(),
      output: `Tool ${tool} executed successfully`,
      params
    }
  };
  
  res.json(result);
});

// ============================================================================
// Session List API (v1)
// ============================================================================
app.get('/v1/session/list', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    id: s.id,
    status: s.status,
    created_at: s.created_at
  }));
  res.json({ sessions: sessionList });
});

// ============================================================================
// Session Sync API
// ============================================================================
app.get('/api/v1/sessions/sync', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial sync data
  res.write(`data: ${JSON.stringify({ type: 'sync', status: 'connected' })}\n\n`);
  
  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ============================================================================
// Legacy Routes for Compatibility
// ============================================================================
app.get('/api/v1/sessions', (req, res) => {
  const sessionList = Array.from(sessions.values());
  res.json({ sessions: sessionList });
});

app.post('/api/v1/sessions', (req, res) => {
  const session = {
    id: uuidv4(),
    ...req.body,
    status: 'active',
    created_at: new Date().toISOString()
  };
  sessions.set(session.id, session);
  res.status(201).json(session);
});

// ============================================================================
// Start Server
// ============================================================================
app.listen(PORT, () => {
  console.log(`[Rails API] Server listening on port ${PORT}`);
  console.log(`[Rails API] Endpoints:`);
  console.log(`  - GET  /health`);
  console.log(`  - GET  /api/v1/providers`);
  console.log(`  - GET  /api/v1/providers/auth/status`);
  console.log(`  - GET  /api/v1/agents`);
  console.log(`  - GET  /api/v1/agent-sessions`);
  console.log(`  - GET  /api/rails/wihs`);
  console.log(`  - POST /api/v1/gateway/tool`);
  console.log(`  - GET  /v1/session/list`);
  console.log(`  - GET  /api/v1/sessions/sync`);
});
