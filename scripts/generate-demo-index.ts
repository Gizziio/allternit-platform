#!/usr/bin/env npx tsx
/**
 * Auto-generate the A://Labs demo site index.html
 *
 * Scans alabs-generated-courses/ and alabs-demos/ for HTML modules,
 * reads metadata from each file, and generates an up-to-date index.
 *
 * Usage:
 *   npx tsx scripts/generate-demo-index.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const DEMOS_DIR = 'alabs-demos';
const GENERATED_DIR = 'alabs-generated-courses';

interface ModuleInfo {
  filename: string;
  title: string;
  course: string;
  moduleNum: number;
  tier: string;
  sizeKb: number;
  features: string[];
}

const TIER_META: Record<string, { color: string; label: string; description: string }> = {
  CORE:   { color: '#3b82f6', label: 'Core Tier', description: 'Foundation Skills' },
  OPS:    { color: '#8b5cf6', label: 'OPS Tier', description: 'Infrastructure & Operations' },
  AGENTS: { color: '#ec4899', label: 'Agents Tier', description: 'Advanced Systems' },
  ADV:    { color: '#f59e0b', label: 'Advanced Tier', description: 'Allternit Architecture' },
};

async function scanModules(dir: string): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = [];
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html') || entry === 'index.html') continue;

      const filepath = path.join(dir, entry);
      const stat = await fs.stat(filepath);
      const content = await fs.readFile(filepath, 'utf-8');

      // Extract metadata from HTML
      const titleMatch = content.match(/<title>(.*?) — A:\/\/Labs<\/title>/);
      const tierMatch = content.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
      const courseMatch = entry.match(/ALABS-([A-Z]+)-([A-Z]+)/);

      const tierColor = tierMatch ? tierMatch[1].toLowerCase() : '';
      let tier = 'ADV';
      if (tierColor.includes('3b82f6')) tier = 'CORE';
      else if (tierColor.includes('8b5cf6')) tier = 'OPS';
      else if (tierColor.includes('ec4899')) tier = 'AGENTS';

      const title = titleMatch ? titleMatch[1] : entry;
      const modNumMatch = title.match(/Module (\d+)/);
      const moduleNum = modNumMatch ? parseInt(modNumMatch[1]) : 0;

      // Detect features
      const features: string[] = [];
      if (content.includes('<canvas')) features.push('🎬 Animations');
      if (content.includes('quiz') || content.includes('Quiz')) features.push('🧩 Quizzes');
      if (content.includes('capstone') || content.includes('Capstone')) features.push('🎯 Capstone');
      if (content.includes('dag') || content.includes('DAG')) features.push('📊 DAG Viz');
      if (content.includes('sim') || content.includes('Sim')) features.push('⚙️ Simulation');
      if (content.includes('chat') || content.includes('Chat')) features.push('💬 Group Chat');

      modules.push({
        filename: entry,
        title,
        course: courseMatch ? courseMatch[0] : entry.replace('-module', '').replace('.html', ''),
        moduleNum,
        tier,
        sizeKb: Math.round(stat.size / 1024 * 10) / 10,
        features: features.length > 0 ? features : ['📖 Interactive'],
      });
    }
  } catch {
    // Directory might not exist
  }
  return modules;
}

function generateTierSection(tier: string, modules: ModuleInfo[]): string {
  const meta = TIER_META[tier] || TIER_META.ADV;
  const cards = modules.map(m => `
        <a href="${m.filename}" class="module-card ${tier.toLowerCase()}">
          <div class="card-header">
            <span class="card-badge ${tier.toLowerCase()}">${tier}</span>
            <span style="font-size: 12px; color: var(--text-muted);">Module ${m.moduleNum}</span>
          </div>
          <div class="card-title">${m.title.replace(/^Module \d+: /, '')}</div>
          <div class="card-desc">${m.title}</div>
          <div class="card-meta">
            ${m.features.map(f => `<span>${f}</span>`).join('\n            ')}
          </div>
          <div class="card-footer" style="color: ${meta.color};">
            Open Demo <span class="arrow">→</span>
          </div>
        </a>`).join('\n');

  return `
    <!-- ${meta.label} -->
    <div class="tier-section">
      <div class="tier-header">
        <div class="tier-dot" style="background: ${meta.color};"></div>
        <div class="tier-name" style="color: ${meta.color};">${meta.label}</div>
        <div class="tier-count">${meta.description}</div>
      </div>
      <div class="module-grid">
${cards}
      </div>
    </div>`;
}

async function generateIndex() {
  console.log('🔍 Scanning for modules...');

  const [generatedModules, demoModules] = await Promise.all([
    scanModules(GENERATED_DIR),
    scanModules(DEMOS_DIR),
  ]);

  // Merge and deduplicate (prefer demos dir if same file exists)
  const allModules = [...generatedModules, ...demoModules];
  const seen = new Set<string>();
  const uniqueModules = allModules.filter(m => {
    if (seen.has(m.filename)) return false;
    seen.add(m.filename);
    return true;
  });

  // Group by tier
  const byTier: Record<string, ModuleInfo[]> = {};
  for (const m of uniqueModules) {
    byTier[m.tier] = byTier[m.tier] || [];
    byTier[m.tier].push(m);
  }

  // Sort modules within each tier by course then module number
  for (const tier of Object.keys(byTier)) {
    byTier[tier].sort((a, b) => {
      if (a.course !== b.course) return a.course.localeCompare(b.course);
      return a.moduleNum - b.moduleNum;
    });
  }

  const tierOrder = ['ADV', 'AGENTS', 'OPS', 'CORE'];
  const tierSections = tierOrder
    .filter(t => byTier[t]?.length > 0)
    .map(t => generateTierSection(t, byTier[t]))
    .join('\n');

  const totalModules = uniqueModules.length;
  const totalSize = uniqueModules.reduce((sum, m) => sum + m.sizeKb, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A://Labs — Interactive Course Demos</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0b0b0c;
      --bg-secondary: #111113;
      --bg-tertiary: #1a1a1d;
      --border: #27272a;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent-core: #3b82f6;
      --accent-ops: #8b5cf6;
      --accent-agents: #ec4899;
      --accent-adv: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }
    header {
      padding: 48px 24px;
      text-align: center;
      background: linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent-ops);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto;
    }
    .stats-bar {
      display: flex;
      gap: 24px;
      justify-content: center;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-primary);
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-bar {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid;
    }
    .badge.offline { background: rgba(52,211,153,0.1); color: #34d399; border-color: rgba(52,211,153,0.3); }
    .badge.open { background: rgba(139,92,246,0.1); color: #a78bfa; border-color: rgba(139,92,246,0.3); }
    .badge.single-file { background: rgba(251,191,36,0.1); color: #fbbf24; border-color: rgba(251,191,36,0.3); }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 48px 24px;
    }

    .tier-section { margin-bottom: 48px; }
    .tier-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .tier-dot { width: 10px; height: 10px; border-radius: 50%; }
    .tier-name {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .tier-count {
      margin-left: auto;
      font-size: 13px;
      color: var(--text-muted);
    }

    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .module-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .module-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    }
    .module-card.core:hover { border-color: var(--accent-core); }
    .module-card.ops:hover { border-color: var(--accent-ops); }
    .module-card.agents:hover { border-color: var(--accent-agents); }
    .module-card.adv:hover { border-color: var(--accent-adv); }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-badge {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-badge.core { background: rgba(59,130,246,0.15); color: var(--accent-core); }
    .card-badge.ops { background: rgba(139,92,246,0.15); color: var(--accent-ops); }
    .card-badge.agents { background: rgba(236,72,153,0.15); color: var(--accent-agents); }
    .card-badge.adv { background: rgba(245,158,11,0.15); color: var(--accent-adv); }

    .card-title {
      font-size: 17px;
      font-weight: 600;
      line-height: 1.3;
    }
    .card-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
      flex: 1;
    }
    .card-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
    }
    .card-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }
    .card-footer .arrow { transition: transform 0.2s; }
    .module-card:hover .arrow { transform: translateX(4px); }

    footer {
      text-align: center;
      padding: 40px 24px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 14px;
    }
    footer a { color: var(--accent-ops); text-decoration: none; }

    @media (max-width: 640px) {
      h1 { font-size: 28px; }
      .module-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">A://Labs</div>
    <h1>Interactive Course Demos</h1>
    <p class="subtitle">Self-contained HTML modules generated directly from the Allternit codebase. Open them in any browser — they work entirely offline.</p>
    <div class="stats-bar">
      <div class="stat">
        <div class="stat-value">${totalModules}</div>
        <div class="stat-label">Modules</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Math.round(totalSize)}KB</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat">
        <div class="stat-value">10</div>
        <div class="stat-label">Courses</div>
      </div>
    </div>
    <div class="badge-bar">
      <span class="badge offline">✓ Works Offline</span>
      <span class="badge open">✓ Open Source</span>
      <span class="badge single-file">✓ Single File</span>
    </div>
  </header>

  <div class="container">
${tierSections}
  </div>

  <footer>
    <p>A://Labs is the learning engine of <a href="https://allternit.com" target="_blank">Allternit</a>.</p>
    <p style="margin-top: 8px; font-size: 13px;">These demos are self-contained HTML files. They require no server, no build step, and no internet connection once loaded.</p>
  </footer>
</body>
</html>`;

  await fs.writeFile(path.join(DEMOS_DIR, 'index.html'), html, 'utf-8');
  console.log(`✅ Generated ${DEMOS_DIR}/index.html`);
  console.log(`   ${totalModules} modules, ${Math.round(totalSize)}KB total`);
}

generateIndex().catch(err => {
  console.error(err);
  process.exit(1);
});
