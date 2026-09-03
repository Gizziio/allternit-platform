/**
 * Browser history memory client.
 *
 * Sends visited pages to the Allternit memory API so the agent can recall
 * recent browsing context during planning.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';
const HISTORY_INGESTION_KEY = 'AllternitHistoryIngestionEnabled';

export async function isHistoryIngestionEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(HISTORY_INGESTION_KEY);
  // Default to enabled.
  return result[HISTORY_INGESTION_KEY] !== false;
}

export async function setHistoryIngestionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_INGESTION_KEY]: enabled });
}

interface HistoryVisit {
  url: string;
  title?: string;
  visitTime?: string;
  transitionType?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get('AllternitClerkJwt');
  const token = result.AllternitClerkJwt;
  if (!token) {
    throw new Error('Not authenticated with Allternit');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function recordBrowserVisit(visit: HistoryVisit): Promise<void> {
  // Skip chrome internals, local files, and extension pages.
  if (!visit.url || visit.url.startsWith('chrome://') || visit.url.startsWith('chrome-extension://')) {
    return;
  }

  const response = await fetch(`${GATEWAY_URL}/api/v1/memory/browser-history/visit`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      url: visit.url,
      title: visit.title,
      visit_time: visit.visitTime,
      transition_type: visit.transitionType,
      source: 'browser-extension',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`History record failed: ${response.status} ${text}`);
  }
}
