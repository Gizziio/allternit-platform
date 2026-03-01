/**
 * Stream Diagnostic - Direct Terminal Server Test
 * 
 * Run: bun tests/stream-direct-test.ts
 */

const TERMINAL_SERVER = 'http://localhost:4096';

async function testStream() {
  console.log('🚀 Terminal Server Stream Diagnostic\n');
  console.log(`Target: ${TERMINAL_SERVER}\n`);

  // Create session
  console.log('📝 Creating session...');
  const createRes = await fetch(`${TERMINAL_SERVER}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Stream Diagnostic Test' }),
  });

  if (!createRes.ok) {
    console.error(`❌ Failed to create session: ${createRes.status}`);
    return;
  }

  const session = await createRes.json();
  const sessionID = session.id;
  console.log(`✅ Session created: ${sessionID}\n`);

  // Stream a prompt
  console.log('📡 Making stream request...\n');
  
  const streamRes = await fetch(`${TERMINAL_SERVER}/session/${sessionID}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text: 'Say hello in exactly 5 words' }],
      model: { providerID: 'opencode', modelID: 'big-pickle' },
    }),
  });

  if (!streamRes.ok) {
    console.error(`❌ Stream request failed: ${streamRes.status}`);
    const errorText = await streamRes.text();
    console.error(errorText);
    await cleanup(sessionID);
    return;
  }

  // Log headers
  console.log('📡 Response Headers:');
  console.log(`   Content-Type: ${streamRes.headers.get('content-type')}`);
  console.log(`   Transfer-Encoding: ${streamRes.headers.get('transfer-encoding') || 'NOT SET'}`);
  console.log(`   Cache-Control: ${streamRes.headers.get('cache-control')}`);
  console.log(`   X-Accel-Buffering: ${streamRes.headers.get('x-accel-buffering') || 'NOT SET'}`);
  console.log();

  // Read full response first to see what we got
  const fullText = await streamRes.text();
  
  console.log('📄 Full Response:');
  console.log('---');
  console.log(fullText);
  console.log('---\n');

  // Analyze
  console.log('🔍 ANALYSIS:');
  
  const lines = fullText.split('\n').filter(l => l.trim());
  console.log(`📊 Total lines: ${lines.length}`);
  
  let hasNDJSON = false;
  let hasSingleJSON = false;
  
  try {
    const firstLine = lines[0];
    JSON.parse(firstLine);
    hasNDJSON = true;
    console.log('   ✅ Response is NDJSON format');
  } catch {
    try {
      JSON.parse(fullText);
      hasSingleJSON = true;
      console.log('   ❌ Response is single JSON object (NOT STREAMING)');
      console.log('      → Server returned complete response instead of stream');
    } catch {
      console.log('   ❌ Response is neither valid JSON nor NDJSON');
    }
  }

  if (hasNDJSON && lines.length > 1) {
    console.log('\n📋 Events:');
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      try {
        const event = JSON.parse(lines[i]);
        console.log(`   ${i + 1}. ${event.type || 'unknown'}${event.delta?.text ? ` "${event.delta.text.slice(0, 30)}"` : ''}`);
      } catch {
        console.log(`   ${i + 1}. (parse error)`);
      }
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  if (hasSingleJSON) {
    console.log('║  ❌ DIAGNOSIS: Server is NOT streaming - returns complete response');
    console.log('║     Check: session.ts stream() handler and Hono configuration');
  } else if (hasNDJSON && lines.length > 5) {
    console.log('║  ✅ DIAGNOSIS: Server is streaming properly');
  } else {
    console.log('║  ⚠️  DIAGNOSIS: Unclear - check response format');
  }
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await cleanup(sessionID);
}

async function cleanup(sessionID: string) {
  try {
    await fetch(`${TERMINAL_SERVER}/session/${sessionID}`, { method: 'DELETE' });
  } catch {}
}

testStream().catch(console.error);
