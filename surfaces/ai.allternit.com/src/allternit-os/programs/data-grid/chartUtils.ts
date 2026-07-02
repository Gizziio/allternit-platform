/**
 * Data Grid Charting Utilities
 */

import type { DataGridColumn, DataGridRow } from '../../types/programs';

export function buildChartJsHtml(
  type: string,
  xColId: string,
  yColId: string,
  columns: DataGridColumn[],
  rows: DataGridRow[],
  title: string,
): string {
  const xCol = columns.find(c => c.id === xColId);
  const yCol = columns.find(c => c.id === yColId);
  if (!xCol || !yCol) return `<html><body><p style="color:#aaa;font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,sans-serif;padding:16px">No numeric column found for chart</p></body></html>`;

  const labels = rows.map(r => String(r.cells[xColId] ?? ''));
  const values = rows.map(r => {
    const v = r.cells[yColId];
    return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
  });

  const chartType = type === 'line' ? 'line' : type === 'pie' ? 'pie' : 'bar';
  const colors = values.map((v, i) => `hsl(${(i * 47 + 210) % 360},65%,55%)`);

  const datasetConfig = chartType === 'pie'
    ? `{
        data: ${JSON.stringify(values)},
        backgroundColor: ${JSON.stringify(colors)},
      }`
    : `{
        label: '${yCol.header}',
        data: ${JSON.stringify(values)},
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderColor: 'rgba(59,130,246,1)',
        borderWidth: 1,
        borderRadius: 4,
      }`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  body { margin:0; padding:12px; background:#0f172a; font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,sans-serif; }
  h3 { color:#f1f5f9; font-size:13px; margin:0 0 10px; font-weight:500; }
  canvas { max-height:280px; }
</style>
</head>
<body>
<h3>${title}</h3>
<canvas id="chart"></canvas>
<script>
  new Chart(document.getElementById('chart'), {
    type: '${chartType}',
    data: {
      labels: ${JSON.stringify(labels)},
      datasets: [${datasetConfig}],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      },
      scales: ${chartType === 'pie' ? '{}' : `{
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      }`}
    }
  });
</script>
</body>
</html>`;
}
