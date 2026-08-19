#!/usr/bin/env node
/**
 * Backend integration smoke test for HAR-derived API capture.
 * Exercises ingest → session → contract → replay → client generation.
 * No jq/screenshots required.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const API_PORT = 8013;
const API_BASE = `http://127.0.0.1:${API_PORT}`;
const USER_ID = 'test-capture-user';
const USER_EMAIL = 'test@allternit.local';
const DESKTOP_ACCESS_TOKEN = 'smoke-test-token-' + Math.random().toString(36).slice(2);

const HAR_JSON = {
  log: {
    version: '1.2',
    creator: { name: 'capture-smoke-test', version: '1.0.0' },
    entries: [
      {
        startedDateTime: '2026-08-17T18:00:00.000Z',
        time: 120,
        request: {
          method: 'GET',
          url: 'https://httpbin.org/get?foo=bar',
          httpVersion: 'HTTP/2',
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: 'Host', value: 'httpbin.org' },
          ],
          queryString: [{ name: 'foo', value: 'bar' }],
          cookies: [],
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: 'OK',
          httpVersion: 'HTTP/2',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: 64,
            mimeType: 'application/json',
            text: '{"args":{"foo":"bar"},"url":"https://httpbin.org/get?foo=bar"}',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: 64,
        },
        cache: {},
        timings: { blocked: -1, dns: -1, connect: -1, send: -1, wait: 120, receive: -1, ssl: -1 },
      },
    ],
  },
};

function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-allternit-user-id': USER_ID,
      'x-allternit-user-email': USER_EMAIL,
      'x-allternit-desktop-access-token': DESKTOP_ACCESS_TOKEN,
      ...(options.headers || {}),
    },
  });
}

function startBackend() {
  console.log('[smoke] Starting allternit-api...');
  const proc = spawn('cargo', ['run', '--quiet'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      ALLTERNIT_DESKTOP_ACCESS_TOKEN: DESKTOP_ACCESS_TOKEN,
    },
  });

  const cleanup = () => {
    console.log('[smoke] Stopping backend...');
    proc.kill('SIGTERM');
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return proc;
}

async function waitForBackend() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${API_BASE}/health/live`);
      if (res.status === 200) {
        console.log('[smoke] Backend ready.');
        return;
      }
    } catch {}
    await sleep(2000);
  }
  throw new Error('Backend did not become ready');
}

async function main() {
  const backend = startBackend();
  await waitForBackend();

  try {
    // 1. Ingest HAR directly.
    console.log('[smoke] POST /har-derived-api/ingest');
    const ingestRes = await api('/api/har-derived-api/ingest', {
      method: 'POST',
      body: JSON.stringify({ har: JSON.stringify(HAR_JSON) }),
    });
    if (ingestRes.status !== 200) {
      throw new Error(`Ingest returned ${ingestRes.status}: ${await ingestRes.text()}`);
    }
    const ingestBody = await ingestRes.json();
    console.log('[smoke] Ingest response:', JSON.stringify(ingestBody, null, 2));
    if (ingestBody.stats.api_entries !== 1) {
      throw new Error(`Expected 1 endpoint, got ${ingestBody.stats.api_entries}`);
    }
    console.log('[smoke] Ingest OK.');

    // 2. Create a capture session and stop it with the HAR to persist a contract.
    console.log('[smoke] POST /har-derived-api/sessions');
    const sessionRes = await api('/api/har-derived-api/sessions', {
      method: 'POST',
      body: JSON.stringify({ domain: 'httpbin.org', source: 'aci' }),
    });
    if (sessionRes.status !== 200) {
      throw new Error(`Create session returned ${sessionRes.status}: ${await sessionRes.text()}`);
    }
    const sessionBody = await sessionRes.json();
    const sessionId = sessionBody.session?.id;
    console.log('[smoke] Session:', sessionId);

    console.log(`[smoke] POST /har-derived-api/sessions/${sessionId}/stop`);
    const stopRes = await api(`/api/har-derived-api/sessions/${sessionId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ har: JSON.stringify(HAR_JSON) }),
    });
    if (stopRes.status !== 200) {
      throw new Error(`Stop session returned ${stopRes.status}: ${await stopRes.text()}`);
    }
    const stopBody = await stopRes.json();
    console.log('[smoke] Stop response:', JSON.stringify(stopBody, null, 2));

    const contractId = stopBody.contract?.id;
    const endpointId = stopBody.endpoints?.[0]?.id;
    if (!contractId || !endpointId) {
      throw new Error('Contract or endpoint missing from stop response');
    }
    console.log(`[smoke] Contract persisted: ${contractId}, endpoint: ${endpointId}`);

    // 3. List contracts and verify the new one appears.
    console.log('[smoke] GET /har-derived-api/contracts');
    const contractsRes = await api('/api/har-derived-api/contracts');
    if (contractsRes.status !== 200) {
      throw new Error(`List contracts returned ${contractsRes.status}: ${await contractsRes.text()}`);
    }
    const contractsBody = await contractsRes.json();
    const found = contractsBody.contracts?.some((c) => c.id === contractId);
    if (!found) {
      throw new Error('Persisted contract not found in list');
    }
    console.log('[smoke] Contract list OK.');

    // 4. Replay the captured endpoint server-side.
    console.log('[smoke] POST /har-derived-api/replay');
    const replayRes = await api('/api/har-derived-api/replay', {
      method: 'POST',
      body: JSON.stringify({ endpoint_id: endpointId, query_params: { foo: 'replayed' } }),
    });
    if (replayRes.status !== 200) {
      throw new Error(`Replay returned ${replayRes.status}: ${await replayRes.text()}`);
    }
    const replayBody = await replayRes.json();
    console.log('[smoke] Replay response:', JSON.stringify(replayBody, null, 2));
    if (replayBody.status !== 200) {
      throw new Error(`Replay proxy status was ${replayBody.status}`);
    }
    console.log('[smoke] Replay OK.');

    // 5. Generate a Python client from the contract.
    console.log('[smoke] POST /har-derived-api/client');
    const clientRes = await api('/api/har-derived-api/client', {
      method: 'POST',
      body: JSON.stringify({ endpoints: [endpointId], language: 'python' }),
    });
    if (clientRes.status !== 200) {
      throw new Error(`Client generation returned ${clientRes.status}: ${await clientRes.text()}`);
    }
    const clientBody = await clientRes.json();
    console.log('[smoke] Client response:', JSON.stringify({ language: clientBody.language, code_length: clientBody.code?.length }, null, 2));
    if (!clientBody.code || clientBody.code.length < 10) {
      throw new Error('Generated client code is too short');
    }
    console.log('[smoke] Client generation OK.');
    console.log('[smoke] All backend capture checks passed.');
  } finally {
    backend.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message);
  process.exit(1);
});
