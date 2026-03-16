import http from 'node:http';
import { spawn } from 'node:child_process';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/run' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { prompt, sandboxMode } = JSON.parse(body || '{}');
        console.log(`Received sandboxMode: ${sandboxMode}`);

        res.writeHead(200, { 'Content-Type': 'text-event-stream' });

        let args;
        if (sandboxMode === 'full') {
          // Use the flag that actually bypasses all sandbox restrictions
          args = ['--dangerously-bypass-approvals-and-sandbox', 'exec', prompt];
          console.log('Spawning codex with full access args');
        } else {
          args = ['--sandbox', 'read-only', 'exec', prompt];
          console.log('Spawning codex with read-only args');
        }

        // Use full path and simple args
        const child = spawn('/opt/homebrew/bin/codex', args);
        
        child.stdout.on('data', d => {
          res.write(`data: ${JSON.stringify({ t: 'model.output', text: d.toString() })}\n\n`);
        });
        
        child.on('close', () => {
          res.write(`data: ${JSON.stringify({ t: 'run.finished' })}\n\n`);
          res.end();
        });

        child.on('error', e => {
          res.write(`data: ${JSON.stringify({ t: 'model.error', text: e.message })}\n\n`);
          res.end();
        });
      } catch (e) {
        res.end();
      }
    });
    return;
  }
  
  res.writeHead(200);
  res.end('STABLE');
});

server.listen(3009, '0.0.0.0');
