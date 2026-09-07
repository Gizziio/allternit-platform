/**
 * Desktop Cloud Admin — lightweight client for the Allternit Desktop-as-a-Service
 * control plane. Used by the standalone admin page; exported functions are also
 * unit-testable by passing a mock fetch implementation.
 */

export const DEFAULT_API_BASE = 'http://127.0.0.1:8013/api/v1';

function apiUrl(base, path) {
  const root = (base || DEFAULT_API_BASE).replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}${p}`;
}

async function apiGet(base, path, fetchImpl) {
  const res = await fetchImpl(apiUrl(base, path));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(base, path, fetchImpl) {
  const res = await fetchImpl(apiUrl(base, path), { method: 'POST' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

export async function listAgents(baseUrl, fetchImpl = fetch) {
  const data = await apiGet(baseUrl, '/agents', fetchImpl);
  return data.agents || [];
}

export async function listTemplates(baseUrl, fetchImpl = fetch) {
  const data = await apiGet(baseUrl, '/desktop-templates', fetchImpl);
  return data.templates || [];
}

export async function getCapacity(baseUrl, fetchImpl = fetch) {
  return apiGet(baseUrl, '/desktop-capacity', fetchImpl);
}

export async function getUsageSummary(baseUrl, fetchImpl = fetch) {
  return apiGet(baseUrl, '/desktop-usage/summary', fetchImpl);
}

export async function provisionDesktop(botId, templateId, baseUrl, fetchImpl = fetch) {
  const qs = templateId ? `?template_id=${encodeURIComponent(templateId)}` : '';
  return apiPost(baseUrl, `/bots/${encodeURIComponent(botId)}/desktop/provision${qs}`, fetchImpl);
}
