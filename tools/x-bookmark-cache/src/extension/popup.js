const SERVER_URL = 'http://localhost:34100';

async function init() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const countEl = document.getElementById('count');

  try {
    const health = await fetch(`${SERVER_URL}/health`);
    if (health.ok) {
      statusDot.classList.remove('offline');
      statusText.textContent = 'Server online';
      const stats = await fetch(`${SERVER_URL}/api/stats`).then(r => r.json());
      countEl.textContent = stats.totalBookmarks.toLocaleString();
    } else {
      throw new Error('unhealthy');
    }
  } catch {
    statusDot.classList.add('offline');
    statusText.textContent = 'Server offline';
    countEl.textContent = '0';
  }

  document.getElementById('openViewer').addEventListener('click', () => {
    chrome.tabs.create({ url: `${SERVER_URL}/viewer` });
  });

  document.getElementById('exportJson').addEventListener('click', async () => {
    const data = await fetch(`${SERVER_URL}/api/export/json`).then(r => r.json());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `x-bookmarks-${new Date().toISOString().slice(0,10)}.json` });
  });

  document.getElementById('exportPipeline').addEventListener('click', async () => {
    const data = await fetch(`${SERVER_URL}/api/export/pipeline`).then(r => r.json());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: 'bookmarks-pipeline.json' });
  });
}

init();
