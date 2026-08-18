/**
 * Cloudflare Pages Function: /api/agent-chat
 *
 * Proxies the office apps' agent-chat requests to any OpenAI-compatible chat
 * completions endpoint. The API key stays server-side; the browser only sends
 * the instruction and an optional system prompt.
 *
 * Required environment variables (set in the Cloudflare Pages dashboard):
 *   MODEL_API_KEY  - Bearer token for the model API
 *   MODEL_API_BASE - Base URL for the provider, e.g. https://api.provider.com/v1
 *   MODEL_ID       - Model id, e.g. gpt-4o, claude-3-5-sonnet, etc.
 */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('origin') ?? '*'
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  })
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get('origin') ?? '*'
  const cors = corsHeaders(origin)

  const env = context.env
  const apiKey = env.MODEL_API_KEY
  const apiBase = typeof env.MODEL_API_BASE === 'string' ? env.MODEL_API_BASE.trim().replace(/\/$/, '') : ''
  const model = typeof env.MODEL_ID === 'string' ? env.MODEL_ID.trim() : ''

  if (!apiKey || !apiBase || !model) {
    return new Response(
      JSON.stringify({
        error:
          'Model not configured. Set MODEL_API_KEY, MODEL_API_BASE, and MODEL_ID in the Pages environment variables.',
      }),
      {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  }

  let body
  try {
    body = await context.request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { message, systemPrompt, runtimeModelId } = body
  if (typeof message !== 'string' || !message.trim()) {
    return new Response(JSON.stringify({ error: 'missing message' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const messages = []
  if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() })
  }
  messages.push({ role: 'user', content: message.trim() })

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: runtimeModelId || model,
      messages,
      stream: true,
      stream_options: { include_usage: false },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error')
    return new Response(JSON.stringify({ error: `upstream error ${response.status}`, detail: text }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const streamUpstream = async () => {
    try {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          let parsed
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }
          const delta = parsed?.choices?.[0]?.delta
          const content = typeof delta?.content === 'string' ? delta.content : ''
          if (content) {
            const chunk = JSON.stringify({ chunk_type: 'text', chunk: content })
            await writer.write(encoder.encode(`data: ${chunk}\n\n`))
          }
        }
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk_type: 'done' })}\n\n`))
    } catch (err) {
      const errorChunk = JSON.stringify({ chunk_type: 'error', chunk: err instanceof Error ? err.message : String(err) })
      await writer.write(encoder.encode(`data: ${errorChunk}\n\n`))
    } finally {
      await writer.close()
    }
  }

  context.waitUntil(streamUpstream())

  return new Response(readable, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
