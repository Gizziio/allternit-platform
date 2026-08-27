const WebSocket = require('/Users/joe/Desktop/allternit-workspace/allternit/node_modules/ws');
const http = require('http');

http.get('http://127.0.0.1:9222/json/list', (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    const pages = JSON.parse(data);
    const page = pages.find((p) => p.type === 'page');
    if (!page) {
      console.error('no page');
      process.exit(1);
    }
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    socket.on('open', () => {
      const expr = `
        (() => {
          const out = { url: location.href, title: document.title, errors: [] };
          try {
            out.headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).slice(0, 10);
            out.tabs = Array.from(document.querySelectorAll('[role="tab"], button, a')).map(b => b.innerText || b.textContent).filter(t => t && t.trim()).slice(0, 40);
            out.cards = document.querySelectorAll('[data-card]').length;
            out.bodyText = document.body.innerText.slice(0, 800);
          } catch (e) { out.errors.push(e.message); }
          return JSON.stringify(out);
        })()
      `;
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    });
    socket.on('message', (m) => {
      const msg = JSON.parse(m);
      if (msg.id === 1) {
        console.log(msg.result?.result?.value);
        socket.close();
        process.exit(0);
      }
    });
    socket.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
  });
});
