/**
 * Simple stream test - raw output only
 */

const SERVER = 'http://localhost:4096';

async function main() {
  // Create session
  const createRes = await fetch(`${SERVER}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'test' }),
  });
  const session = await createRes.json();
  console.log(`Session: ${session.id}\n`);
  
  // Stream
  const res = await fetch(`${SERVER}/session/${session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Say hello in 5 words' }],
      model: { providerID: 'opencode', modelID: 'big-pickle' },
    }),
  });
  
  console.log(`Content-Type: ${res.headers.get('content-type')}\n`);
  console.log('Raw stream:\n---');
  
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(decoder.decode(value));
    }
  } finally {
    reader.releaseLock();
  }
  
  console.log('\n---\nDone');
  
  await fetch(`${SERVER}/session/${session.id}`, { method: 'DELETE' });
}

main().catch(console.error);
