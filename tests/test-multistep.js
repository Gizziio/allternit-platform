const SERVER = 'http://localhost:4096';

async function test() {
  const createRes = await fetch(`${SERVER}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'multistep test' }),
  });
  const session = await createRes.json();
  console.log('Session:', session.id);
  console.log('\nStreaming multi-step task:\n');
  
  const res = await fetch(`${SERVER}/session/${session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Create todo: 1) HTML 2) CSS 3) JS' }],
      model: { providerID: 'opencode', modelID: 'big-pickle' },
    }),
  });
  
  if (!res.body) return;
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const startTime = Date.now();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const elapsed = Date.now() - startTime;
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'content_block_start') {
            console.log(`[+${elapsed}ms] START: ${event.content_block?.type}`);
          } else if (event.type === 'content_block_delta') {
            const content = event.delta?.text || event.delta?.thinking || '';
            console.log(`[+${elapsed}ms] DELTA ${event.delta?.type}: "${content.slice(0, 60)}..."`);
          } else if (event.type === 'finish') {
            console.log(`[+${elapsed}ms] FINISH`);
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  await fetch(`${SERVER}/session/${session.id}`, { method: 'DELETE' });
}

test().catch(console.error);
