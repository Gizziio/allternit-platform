const { execute } = require('../dist/index');

function createHandler() {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const host = {
      platform: 'http',
      version: '1.0.0',
      llm: {},
      tools: {},
      ui: {},
      storage: {},
      session: {},
      config: {
        get: (key) => process.env[key]
      },
      logger: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
      }
    };

    const result = await execute(host, body);

    res.statusCode = result.success ? 200 : 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  };
}

module.exports = { createHandler };
