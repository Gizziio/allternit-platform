/**
 * Allternit AI API Client
 *
 * Direct platform interface to the Allternit AI service (port 8080).
 * Used for image generation and other AI capabilities.
 * Not a session backend — Gizzi Code handles all sessions.
 */

const getAiUrl = () =>
  (typeof window !== 'undefined' && (window as any).__ALLTERNIT_AI_URL__) ||
  process.env.NEXT_PUBLIC_ALLTERNIT_AI_URL ||
  'http://localhost:8080';

export async function generateImage(params: {
  prompt: string;
  model?: string;
  size?: string;
}): Promise<{ url: string }> {
  const res = await fetch(`${getAiUrl()}/api/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<{ url: string }>;
}
