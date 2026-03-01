// Quick stream test
const SERVER = 'http://localhost:4096';

async function test() {
  // Create session
  const createRes = await fetch(`${SERVER}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'test' }),
  });
  const session = await createRes.json();
  console.log('Session:', session.id);
  
  // Stream
  console.log('\nStreaming...\n');
  const res = await fetch(`${SERVER}/session/${session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Say hello in 5 words' }],
      model: { providerID: 'opencode', modelID: 'big-pickle' },
    }),
  });
  
  if (!res.body) {
    console.error('No body');
    return;
  }
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      process.stdout.write(text);
    }
  } finally {
    reader.releaseLock();
  }
  
  console.log('\n\nDone');
  
  // Cleanup
  await fetch(`${SERVER}/session/${session.id}`, { method: 'DELETE' });
}

test().catch(console.error);
