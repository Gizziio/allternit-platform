/**
 * Test prompt streaming
 * Run: bun tests/test-prompt-stream.ts
 */

const SERVER = 'http://localhost:4096';

async function main() {
  console.log('🧪 Testing prompt streaming...\n');
  
  // Create session
  const createRes = await fetch(`${SERVER}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'stream test' }),
  });
  const session = await createRes.json();
  console.log(`📝 Session: ${session.id}\n`);
  
  // Stream prompt
  console.log('📡 Streaming prompt...\n');
  const streamRes = await fetch(`${SERVER}/session/${session.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Say hello in exactly 5 words' }],
      model: { providerID: 'opencode', modelID: 'big-pickle' },
    }),
  });
  
  console.log('📊 Response Headers:');
  console.log(`   Content-Type: ${streamRes.headers.get('content-type')}`);
  console.log();
  
  if (!streamRes.body) {
    console.error('❌ No body');
    return;
  }
  
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  const startTime = Date.now();
  let lastTime = 0;
  let eventCount = 0;
  
  console.log('📋 Events:');
  
  let rawBuffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const now = Date.now() - startTime;
      const gap = now - lastTime;
      lastTime = now;
      
      const text = decoder.decode(value);
      rawBuffer += text;
      
      console.log(`📦 Raw chunk at +${now}ms: ${text.slice(0, 200).replace(/\n/g, '\\n')}`);
      
      const lines = text.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          eventCount++;
          const deltaText = event.delta?.text || event.delta?.thinking || '';
          const errorMsg = event.error ? ` "${event.error}"` : '';
          console.log(`   +${now}ms (+${gap}ms): ${event.type}${deltaText ? ` "${deltaText}"` : ''}${errorMsg}`);
        } catch (e) {
          console.log(`   +${now}ms: (parse error) ${line.slice(0, 80)}`);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  console.log(`\n📄 Full raw buffer:\n${rawBuffer.slice(0, 2000)}`);
  
  console.log(`\n📊 Total events: ${eventCount}`);
  console.log(`⏱️  Total time: ${lastTime}ms`);
  
  // Cleanup
  await fetch(`${SERVER}/session/${session.id}`, { method: 'DELETE' });
  console.log('\n✅ Done\n');
}

main().catch(console.error);
