/**
 * Internal Operator Service
 * 
 * Port: 3005
 * Role: Hosts the OperatorOrchestrator logic for the Rust Kernel proxy.
 */

import express from 'express';
import { OperatorOrchestrator } from './operator/orchestrator.js';

const app = express();
const orchestrator = new OperatorOrchestrator();
const streams = new Map<string, any>();

app.use(express.json());

app.post('/execute', async (req, res) => {
  const { requestId, intent, context } = req.body;
  console.log(`[OperatorService] Task accepted: ${requestId}`);
  
  const stream = orchestrator.streamTask({ sessionId: requestId, intent, context });
  streams.set(requestId, stream);
  
  res.json({ status: 'accepted', requestId });
});

app.get('/events/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const stream = streams.get(requestId);

  if (!stream) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  
  try {
    for await (const event of stream) {
      res.write(`${JSON.stringify(event)}\n`);
    }
  } catch (err: any) {
    res.write(JSON.stringify({ type: 'error', message: err.message }));
  } finally {
    res.end();
    streams.delete(requestId);
  }
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log(`[OperatorService] Running on port ${PORT}`);
});
