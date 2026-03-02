const http = require('http');

const PORT = 3000;
const SIDECAR_URL = 'http://localhost:8081';

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  if (req.url.includes('/api/v1/chrome-sessions')) {
    // Forward to sidecar, removing /api/v1/chrome-sessions prefix
    let sidecarPath = req.url.replace('/api/v1/chrome-sessions', '');
    if (!sidecarPath) sidecarPath = '/health';
    
    console.log(`  -> ${req.method} ${sidecarPath}`);
    
    const options = {
      hostname: 'localhost',
      port: 8081,
      path: sidecarPath,
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.on('data', (chunk) => res.write(chunk));
      proxyRes.on('end', () => res.end());
    });

    proxyReq.on('error', (e) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    });

    req.on('data', (chunk) => proxyReq.write(chunk));
    req.on('end', () => proxyReq.end());
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h1>A2R Chrome Proxy</h1><p>Running on port ${PORT}</p><p>Forwarding to ${SIDECAR_URL}</p></body></html>`);
  }
});

server.listen(PORT, () => {
  console.log(`Proxy at http://localhost:${PORT} -> ${SIDECAR_URL}`);
});
