/**
 * PlaygroundView
 *
 * Live-rendering AI artifact workbench — Allternit's equivalent of Claude.ai's Artifacts
 * playground. Write a system prompt + messages, hit Run, and see generated
 * HTML / React / SVG / Mermaid outputs rendered live in a sandboxed preview pane.
 *
 * This view is contributed by the "playground" Feature Plugin and only appears
 * in the shell when that plugin is enabled.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtifactType = 'html' | 'jsx' | 'svg' | 'mermaid' | 'markdown' | 'none';

interface Artifact {
  type: ArtifactType;
  title: string;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type TemplateId =
  | 'raw'
  | 'component-variation'
  | 'data-viz'
  | 'copy-review'
  | 'diff-review';

type LeftTab = 'prompt' | 'config' | 'templates';
type RightTab = 'preview' | 'source' | 'console';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function parseArtifactFromText(text: string): Artifact | null {
  const htmlMatch = text.match(/```html\s*([\s\S]+?)(?:```|$)/i);
  if (htmlMatch) return { type: 'html', title: 'Generated HTML', content: htmlMatch[1].trim() };
  const jsxMatch = text.match(/```(?:jsx?|tsx?)\s*([\s\S]+?)(?:```|$)/i);
  if (jsxMatch) return { type: 'jsx', title: 'Generated Component', content: jsxMatch[1].trim() };
  const svgMatch = text.match(/```svg\s*([\s\S]+?)(?:```|$)/i) || text.match(/(<svg[\s\S]+?<\/svg>)/i);
  if (svgMatch) return { type: 'svg', title: 'Generated SVG', content: svgMatch[1].trim() };
  const mermaidMatch = text.match(/```mermaid\s*([\s\S]+?)(?:```|$)/i);
  if (mermaidMatch) return { type: 'mermaid', title: 'Diagram', content: mermaidMatch[1].trim() };
  return null;
}

// ─── Template Definitions ─────────────────────────────────────────────────────

interface TemplateDefinition {
  id: TemplateId;
  label: string;
  description: string;
  systemPrompt: string;
  starterMessage: string;
  demoArtifact: Artifact;
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'raw',
    label: 'Raw',
    description: 'Blank canvas — no template.',
    systemPrompt: 'You are a helpful AI assistant. When asked to create UI or visualizations, produce a self-contained HTML document with embedded CSS and JavaScript. Wrap it in ```html fences.',
    starterMessage: 'Create a beautiful interactive analytics dashboard with charts.',
    demoArtifact: {
      type: 'html',
      title: 'Analytics Dashboard',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f0f0f; color: #e5e5e5; min-height: 100vh; padding: 24px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #d4b08c; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .card { background: #1c1917; border: 1px solid rgba(212,176,140,0.15); border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
  .card:hover { border-color: rgba(212,176,140,0.4); }
  .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin-bottom: 8px; }
  .card .value { font-size: 32px; font-weight: 800; color: #d4b08c; }
  .card .sub { font-size: 12px; color: #57534e; margin-top: 4px; }
  .chart-area { background: #1c1917; border: 1px solid rgba(212,176,140,0.15); border-radius: 12px; padding: 20px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; margin-top: 16px; }
  .bar { flex: 1; background: rgba(212,176,140,0.15); border-radius: 4px 4px 0 0; position: relative; transition: background 0.2s; cursor: pointer; }
  .bar:hover { background: rgba(212,176,140,0.5); }
  .bar .tip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #d4b08c; color: #0f0f0f; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; white-space: nowrap; display: none; }
  .bar:hover .tip { display: block; }
  .x-labels { display: flex; gap: 8px; margin-top: 8px; }
  .x-label { flex: 1; text-align: center; font-size: 10px; color: #57534e; }
</style>
</head>
<body>
  <h1>Analytics Overview</h1>
  <div class="grid">
    <div class="card"><div class="label">Total Requests</div><div class="value">48.2k</div><div class="sub">↑ 12% vs last week</div></div>
    <div class="card"><div class="label">Avg Latency</div><div class="value">142ms</div><div class="sub">↓ 8ms improvement</div></div>
    <div class="card"><div class="label">Success Rate</div><div class="value">99.4%</div><div class="sub">→ Stable</div></div>
  </div>
  <div class="chart-area">
    <div class="label">Daily Requests — Last 7 Days</div>
    <div class="bar-chart" id="chart"></div>
    <div class="x-labels" id="labels"></div>
  </div>
  <script>
    const data = [4200,5800,4900,7200,6100,8400,7600];
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const max = Math.max(...data);
    const chart = document.getElementById('chart');
    const labels = document.getElementById('labels');
    data.forEach((v,i) => {
      const bar = document.createElement('div'); bar.className='bar';
      bar.style.height=(v/max*100)+'%';
      bar.innerHTML='<div class="tip">'+v.toLocaleString()+'</div>';
      chart.appendChild(bar);
      const lbl = document.createElement('div'); lbl.className='x-label';
      lbl.textContent=days[i]; labels.appendChild(lbl);
    });
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'component-variation',
    label: 'Components',
    description: 'Generate multiple UI component variants side-by-side.',
    systemPrompt: 'You are a UI designer. Generate multiple visual variations of the requested component as a self-contained HTML file showing all variants side-by-side with labels. Use a dark design system. Wrap in ```html fences.',
    starterMessage: 'Create 3 variations of a pricing card component.',
    demoArtifact: {
      type: 'html',
      title: 'Pricing Card Variations',
      content: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,sans-serif; background:#0f0f0f; color:#e5e5e5; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px; }
  .row { display:flex; gap:20px; flex-wrap:wrap; justify-content:center; }
  .card { width:210px; border-radius:16px; padding:24px; }
  .v1 { background:#1c1917; border:1px solid rgba(212,176,140,0.2); }
  .v2 { background:linear-gradient(135deg,#d4b08c22,#d4b08c08); border:1px solid #d4b08c; }
  .v3 { background:#d4b08c; color:#0f0f0f; }
  .tier { font-size:11px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.6; }
  .price { font-size:36px; font-weight:800; margin:12px 0 4px; }
  .price span { font-size:16px; font-weight:400; }
  .desc { font-size:12px; opacity:0.6; margin-bottom:16px; }
  .feature { font-size:12px; margin:6px 0; display:flex; align-items:center; gap:6px; }
  .feature::before { content:'✓'; font-weight:700; color:#d4b08c; }
  .v3 .feature::before { color:#0f0f0f; }
  .btn { width:100%; padding:10px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; margin-top:20px; }
  .v1 .btn { background:rgba(212,176,140,0.15); color:#d4b08c; }
  .v2 .btn { background:#d4b08c; color:#0f0f0f; }
  .v3 .btn { background:#0f0f0f; color:#d4b08c; }
  .lbl { text-align:center; font-size:10px; color:#57534e; margin-top:10px; }
</style></head>
<body><div class="row">
  <div><div class="card v1"><div class="tier">Starter</div><div class="price">$9<span>/mo</span></div><div class="desc">For individuals</div><div class="feature">5 projects</div><div class="feature">10GB storage</div><div class="feature">Basic support</div><button class="btn">Get Started</button></div><div class="lbl">Variant A — Minimal</div></div>
  <div><div class="card v2"><div class="tier">Pro</div><div class="price">$29<span>/mo</span></div><div class="desc">For teams</div><div class="feature">Unlimited projects</div><div class="feature">100GB storage</div><div class="feature">Priority support</div><button class="btn">Upgrade</button></div><div class="lbl">Variant B — Glow</div></div>
  <div><div class="card v3"><div class="tier" style="color:#0f0f0f">Enterprise</div><div class="price" style="color:#0f0f0f">$99<span>/mo</span></div><div class="desc" style="color:#0f0f0f">For orgs</div><div class="feature" style="color:#0f0f0f">Everything in Pro</div><div class="feature" style="color:#0f0f0f">SSO &amp; SAML</div><div class="feature" style="color:#0f0f0f">Dedicated support</div><button class="btn">Contact Sales</button></div><div class="lbl">Variant C — Inverted</div></div>
</div></body></html>`,
    },
  },
  {
    id: 'data-viz',
    label: 'Data Viz',
    description: 'Generate interactive charts from raw data.',
    systemPrompt: 'You are a data visualization expert. Create beautiful, interactive visualizations as self-contained HTML using Canvas or SVG — no external libraries. Wrap in ```html fences.',
    starterMessage: 'Visualize monthly revenue: Jan $12k, Feb $18k, Mar $15k, Apr $22k, May $28k, Jun $31k.',
    demoArtifact: {
      type: 'html',
      title: 'Revenue Chart',
      content: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}.wrap{background:#1c1917;border:1px solid rgba(212,176,140,.15);border-radius:16px;padding:24px}h2{color:#d4b08c;font-size:16px;font-weight:700;margin-bottom:20px}</style>
</head><body><div class="wrap"><h2>Monthly Revenue</h2><canvas id="c" width="480" height="240"></canvas></div>
<script>
const data=[12,18,15,22,28,31],labels=['Jan','Feb','Mar','Apr','May','Jun'];
const c=document.getElementById('c'),ctx=c.getContext('2d');
const W=c.width,H=c.height,pad={top:20,right:20,bottom:40,left:50};
const cw=W-pad.left-pad.right,ch=H-pad.top-pad.bottom,max=Math.max(...data)*1.2;
const x=i=>pad.left+(i/(data.length-1))*cw,y=v=>pad.top+ch-(v/max)*ch;
ctx.strokeStyle='rgba(212,176,140,.08)';ctx.lineWidth=1;
[.25,.5,.75,1].forEach(t=>{ctx.beginPath();ctx.moveTo(pad.left,pad.top+ch*(1-t));ctx.lineTo(W-pad.right,pad.top+ch*(1-t));ctx.stroke();ctx.fillStyle='#57534e';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText('$'+Math.round(max*t)+'k',pad.left-6,pad.top+ch*(1-t)+4);});
const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);grad.addColorStop(0,'rgba(212,176,140,.3)');grad.addColorStop(1,'rgba(212,176,140,0)');
ctx.beginPath();ctx.moveTo(x(0),y(data[0]));data.forEach((v,i)=>{if(i>0)ctx.lineTo(x(i),y(v));});ctx.lineTo(x(data.length-1),pad.top+ch);ctx.lineTo(x(0),pad.top+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
ctx.beginPath();ctx.strokeStyle='#d4b08c';ctx.lineWidth=2.5;ctx.lineJoin='round';data.forEach((v,i)=>{i===0?ctx.moveTo(x(i),y(v)):ctx.lineTo(x(i),y(v));});ctx.stroke();
data.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),y(v),5,0,Math.PI*2);ctx.fillStyle='#d4b08c';ctx.fill();ctx.fillStyle='#d4b08c';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('$'+v+'k',x(i),y(v)-12);ctx.fillStyle='#57534e';ctx.font='10px sans-serif';ctx.fillText(labels[i],x(i),H-12);});
</script></body></html>`,
    },
  },
  {
    id: 'copy-review',
    label: 'Copy Review',
    description: 'AI copy review with before/after suggestions.',
    systemPrompt: 'You are a UX writer and copy editor. Review the provided copy and return a self-contained HTML document showing original vs. improved versions side-by-side with annotations. Wrap in ```html fences.',
    starterMessage: 'Review: "Click here to submit your information to proceed to the next step."',
    demoArtifact: {
      type: 'html',
      title: 'Copy Review',
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;font-family:-apple-system,sans-serif;color:#e5e5e5;padding:24px}h2{color:#d4b08c;font-size:18px;margin-bottom:20px;font-weight:700}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.box{background:#1c1917;border-radius:10px;padding:16px}.before{border-left:3px solid #ef4444}.after{border-left:3px solid #22c55e}.label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}.before .label{color:#ef4444}.after .label{color:#22c55e}.text{font-size:14px;line-height:1.6}.note{background:rgba(212,176,140,.08);border-radius:8px;padding:12px 16px;border-left:3px solid #d4b08c}.note p{font-size:12px;color:#a8a29e;line-height:1.5}.note strong{color:#d4b08c}</style></head><body><h2>Copy Review</h2><div class="row"><div class="box before"><div class="label">Before</div><div class="text">"Click here to submit your information to proceed to the next step."</div></div><div class="box after"><div class="label">After</div><div class="text">"Continue"</div></div></div><div class="note"><p><strong>Reduction:</strong> 13 words → 1 word (92% shorter)</p><p><strong>Why:</strong> "Click here" is redundant on a button. "Submit your information" is verbose and clinical. "Proceed to the next step" is bureaucratic. "Continue" is friendly, universally understood, and respects the user's intelligence.</p></div></body></html>`,
    },
  },
  {
    id: 'diff-review',
    label: 'Diff Review',
    description: 'Side-by-side code diffs with AI annotations.',
    systemPrompt: 'You are a senior code reviewer. Produce a self-contained HTML file with a side-by-side diff viewer, line annotations, and a summary of issues. Wrap in ```html fences.',
    starterMessage: 'Review this change: replaced `var` with `const` throughout a JS module.',
    demoArtifact: {
      type: 'html',
      title: 'Diff Review',
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;font-family:'SF Mono',monospace;color:#e5e5e5;padding:24px}h2{font-family:-apple-system,sans-serif;color:#d4b08c;font-size:18px;margin-bottom:20px}.diff{background:#1c1917;border-radius:10px;overflow:hidden;border:1px solid rgba(212,176,140,.1)}.dh{display:grid;grid-template-columns:1fr 1fr;background:#0f0f0f;padding:8px 16px}.dh span{font-size:11px;color:#57534e;font-family:-apple-system,sans-serif}.line{display:grid;grid-template-columns:1fr 1fr}.cell{padding:2px 16px;font-size:12px;line-height:1.7}.del{background:rgba(239,68,68,.1);color:#fca5a5}.add{background:rgba(34,197,94,.1);color:#86efac}.ctx{color:#57534e}.sum{background:rgba(212,176,140,.06);border-radius:10px;padding:16px;margin-top:16px;border:1px solid rgba(212,176,140,.15)}.sum h3{font-family:-apple-system,sans-serif;font-size:13px;color:#d4b08c;margin-bottom:8px}.sum p{font-family:-apple-system,sans-serif;font-size:12px;color:#a8a29e;line-height:1.5}</style></head><body><h2>Diff Review — var → const</h2><div class="diff"><div class="dh"><span>Before</span><span>After</span></div><div class="line"><div class="cell del">- var count = 0;</div><div class="cell add">+ const count = 0;</div></div><div class="line"><div class="cell del">- var name = getUser();</div><div class="cell add">+ const name = getUser();</div></div><div class="line"><div class="cell del">- var items = fetch();</div><div class="cell add">+ const items = fetch();</div></div><div class="line"><div class="cell ctx">  processItems(items);</div><div class="cell ctx">  processItems(items);</div></div><div class="line"><div class="cell del">- var result = compute();</div><div class="cell add">+ const result = compute();</div></div></div><div class="sum"><h3>✓ LGTM — Good change</h3><p>Using <code style="color:#d4b08c">const</code> is correct here since no bindings are reassigned. This prevents accidental mutation and signals intent clearly. If a value needs to change later, upgrade to <code style="color:#d4b08c">let</code> — never back to <code style="color:#ef4444">var</code>.</p></div></body></html>`,
    },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        padding: 0, flexShrink: 0, position: 'relative',
        background: on ? 'rgba(212,176,140,0.9)' : 'rgba(255,255,255,0.1)',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 18 : 3, width: 14, height: 14,
        borderRadius: '50%', background: on ? '#1c1917' : '#78716c', transition: 'left 0.2s',
      }} />
    </button>
  );
}

function ArtifactPreview({ artifact }: { artifact: Artifact | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!artifact || !iframeRef.current) return;
    const iframe = iframeRef.current;
    if (artifact.type === 'html') {
      iframe.srcdoc = artifact.content;
    } else if (artifact.type === 'svg') {
      iframe.srcdoc = `<!DOCTYPE html><html><body style="margin:0;background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh">${artifact.content}</body></html>`;
    }
  }, [artifact]);

  if (!artifact || artifact.type === 'none') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#44403c', gap: 12,
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="2" />
          <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
          Hit <strong style={{ color: '#78716c' }}>Run</strong> to generate and preview an artifact here
        </p>
      </div>
    );
  }

  if (artifact.type === 'mermaid') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <pre style={{
          background: '#1c1917', padding: 20, borderRadius: 10, color: '#d4b08c',
          fontSize: 12, fontFamily: 'monospace', overflowX: 'auto',
        }}>{artifact.content}</pre>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-modals"
      style={{ flex: 1, border: 'none', background: '#0f0f0f', width: '100%', display: 'block' }}
      title="Artifact Preview"
    />
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function PlaygroundView() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('raw');
  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate) ?? TEMPLATES[0];

  const [systemPrompt, setSystemPrompt] = useState(currentTemplate.systemPrompt);
  const [messages, setMessages] = useState<Message[]>([
    { id: uid(), role: 'user', content: currentTemplate.starterMessage },
  ]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [systemExpanded, setSystemExpanded] = useState(true);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [leftTab, setLeftTab] = useState<LeftTab>('prompt');
  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [splitPos, setSplitPos] = useState(42);
  const isDragging = useRef(false);
  const splitRef = useRef<HTMLDivElement>(null);

  const applyTemplate = useCallback((id: TemplateId) => {
    const t = TEMPLATES.find((tpl) => tpl.id === id);
    if (!t) return;
    setActiveTemplate(id);
    setSystemPrompt(t.systemPrompt);
    setMessages([{ id: uid(), role: 'user', content: t.starterMessage }]);
    setStreamText('');
    setArtifact(null);
  }, []);

  const handleRun = useCallback(() => {
    if (isStreaming) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      setIsStreaming(false);
      return;
    }
    setIsStreaming(true);
    setStreamText('');
    setArtifact(null);
    // Show console tab while streaming so the iframe isn't touched mid-stream
    setRightTab('console');

    const demo = currentTemplate.demoArtifact;
    const intro = `I'll create that for you now.\n\n\`\`\`${demo.type}\n`;
    const full = intro + demo.content + '\n```\n';
    let i = 0;
    let accumulated = '';
    // Use larger chunks + longer interval to avoid flooding React with re-renders.
    // 60 chars every 30ms ≈ 2 000 chars/sec — fast enough to feel instant,
    // slow enough that each setState has time to flush before the next one.
    const CHUNK = 60;
    const TICK  = 30;

    streamIntervalRef.current = setInterval(() => {
      if (i >= full.length) {
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        setIsStreaming(false);
        // Set artifact exactly once when stream ends, then flip to preview
        setArtifact(demo);
        setRightTab('preview');
        return;
      }
      const chunk = full.slice(i, Math.min(i + CHUNK, full.length));
      i += CHUNK;
      accumulated += chunk;
      setStreamText(accumulated);
    }, TICK);
  }, [isStreaming, currentTemplate]);

  useEffect(() => () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant') => {
    setMessages((prev) => [...prev, { id: uid(), role, content: '' }]);
  }, []);
  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
  }, []);
  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const container = splitRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.min(70, Math.max(25, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const tokenCount = useMemo(() => {
    const text = systemPrompt + messages.map((m) => m.content).join(' ');
    return Math.round(text.length / 4);
  }, [systemPrompt, messages]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0c0a09', color: '#e7e5e4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        borderBottom: '1px solid rgba(212,176,140,0.1)', background: '#0f0e0d', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="rgba(212,176,140,0.6)" strokeWidth="2" strokeLinecap="round">
          <path d="M9 3h6M10 3v5l-4 10a1 1 0 0 0 .9 1.4h10.2a1 1 0 0 0 .9-1.4L14 8V3"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a87a', letterSpacing: '-0.01em' }}>
          Playground
        </span>

        {/* Template tabs */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 10, padding: '2px', background: '#1a1917', borderRadius: 8 }}>
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => applyTemplate(t.id)} style={{
              padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: activeTemplate === t.id ? 'rgba(212,176,140,0.15)' : 'transparent',
              color: activeTemplate === t.id ? '#d4b08c' : '#57534e', transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: '#3a3733' }}>~{tokenCount.toLocaleString()} tokens</span>

        <select value={model} onChange={(e) => setModel(e.target.value)} style={{
          background: '#1c1917', border: '1px solid rgba(212,176,140,0.12)',
          borderRadius: 6, color: '#78716c', fontSize: 11, padding: '4px 8px', cursor: 'pointer',
        }}>
          <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
          <option value="claude-opus-4-5">claude-opus-4-5</option>
          <option value="claude-haiku-4-5">claude-haiku-4-5</option>
        </select>

        <button onClick={handleRun} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
          borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: isStreaming ? 'rgba(239,68,68,0.12)' : 'rgba(212,176,140,0.85)',
          color: isStreaming ? '#f87171' : '#1c1917', transition: 'all 0.15s',
        }}>
          {isStreaming ? (
            <><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Stop</>
          ) : (
            <><svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><polygon points="1,0.5 8.5,4.5 1,8.5"/></svg> Run</>
          )}
        </button>
      </div>

      {/* ── Split pane ──────────────────────────────────────────────────── */}
      <div ref={splitRef} style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT PANE */}
        <div style={{
          width: `${splitPos}%`, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(212,176,140,0.07)', flexShrink: 0, overflow: 'hidden',
        }}>
          {/* Left tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid rgba(212,176,140,0.07)',
            background: '#0f0e0d', flexShrink: 0,
          }}>
            {(['prompt', 'config', 'templates'] as LeftTab[]).map((tab) => (
              <button key={tab} onClick={() => setLeftTab(tab)} style={{
                padding: '7px 13px', border: 'none', background: 'transparent',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                color: leftTab === tab ? '#d4b08c' : '#4a4542',
                borderBottom: leftTab === tab ? '2px solid #d4b08c' : '2px solid transparent',
                textTransform: 'capitalize',
              }}>{tab}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* PROMPT TAB */}
            {leftTab === 'prompt' && (
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* System prompt block */}
                <div style={{ border: '1px solid rgba(212,176,140,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                  <button onClick={() => setSystemExpanded(v => !v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 10px', background: '#1a1917', border: 'none', cursor: 'pointer',
                    color: '#78716c', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                      style={{ transform: systemExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                      <polygon points="1,0 7,4 1,8"/>
                    </svg>
                    System
                  </button>
                  {systemExpanded && (
                    <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5}
                      style={{
                        width: '100%', background: '#161412', border: 'none', resize: 'vertical',
                        color: '#c9a87a', fontSize: 11, fontFamily: '"SF Mono","Fira Code",monospace',
                        lineHeight: 1.65, padding: '9px 11px', outline: 'none',
                      }}
                      placeholder="You are a helpful assistant..."
                    />
                  )}
                </div>

                {/* Messages */}
                {messages.map((msg) => (
                  <div key={msg.id} style={{
                    border: '1px solid rgba(212,176,140,0.08)', borderRadius: 8,
                    overflow: 'hidden', background: '#1a1917',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px',
                      background: '#141312', borderBottom: '1px solid rgba(212,176,140,0.06)',
                    }}>
                      <select value={msg.role}
                        onChange={(e) => setMessages(prev => prev.map(m =>
                          m.id === msg.id ? { ...m, role: e.target.value as 'user' | 'assistant' } : m
                        ))} style={{
                          background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10,
                          fontWeight: 700, color: msg.role === 'user' ? '#d4b08c' : '#86efac',
                        }}>
                        <option value="user">user</option>
                        <option value="assistant">assistant</option>
                      </select>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => removeMessage(msg.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#3a3733', fontSize: 14, lineHeight: 1, padding: '0 2px',
                      }}>×</button>
                    </div>
                    <textarea value={msg.content} onChange={(e) => updateMessage(msg.id, e.target.value)} rows={3}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', resize: 'vertical',
                        color: '#e7e5e4', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6,
                        padding: '9px 11px', outline: 'none',
                      }}
                      placeholder={msg.role === 'user' ? 'User message...' : 'Assistant prefill...'}
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => addMessage('user')} style={addMsgBtnStyle('#d4b08c')}>+ User</button>
                  <button onClick={() => addMessage('assistant')} style={addMsgBtnStyle('#86efac')}>+ Assistant</button>
                </div>
              </div>
            )}

            {/* CONFIG TAB */}
            {leftTab === 'config' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 22 }}>
                <ConfigSlider label="Temperature" value={temperature} min={0} max={1} step={0.01}
                  display={temperature.toFixed(2)} onChange={setTemperature}
                  hint={['Precise', 'Creative']} />
                <ConfigSlider label="Max tokens" value={maxTokens} min={256} max={8192} step={256}
                  display={maxTokens.toLocaleString()} onChange={setMaxTokens} />
                <div style={{ height: 1, background: 'rgba(212,176,140,0.06)' }} />
                <ConfigToggleRow label="Stream tokens" desc="Render output token-by-token" on={true} />
                <ConfigToggleRow label="Auto-render artifact" desc="Show preview as soon as artifact is detected" on={true} />
                <ConfigToggleRow label="Show thinking" desc="Display extended reasoning when available" on={false} />
              </div>
            )}

            {/* TEMPLATES TAB */}
            {leftTab === 'templates' && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <p style={{ fontSize: 11, color: '#44403c', paddingBottom: 6, lineHeight: 1.5 }}>
                  Templates pre-configure the system prompt and messages for common use cases.
                </p>
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => { applyTemplate(t.id); setLeftTab('prompt'); }}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left',
                      padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeTemplate === t.id ? 'rgba(212,176,140,0.08)' : '#1a1917',
                      outline: activeTemplate === t.id
                        ? '1px solid rgba(212,176,140,0.3)' : '1px solid rgba(255,255,255,0.03)',
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: activeTemplate === t.id ? '#d4b08c' : '#c9c5c2' }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#57534e', lineHeight: 1.4 }}>{t.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DRAG DIVIDER */}
        <div onMouseDown={handleDividerMouseDown}
          style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(212,176,140,0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />

        {/* RIGHT PANE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Right tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 8px',
            borderBottom: '1px solid rgba(212,176,140,0.07)', background: '#0f0e0d', flexShrink: 0,
          }}>
            {(['preview', 'source', 'console'] as RightTab[]).map((tab) => (
              <button key={tab} onClick={() => setRightTab(tab)} style={{
                padding: '7px 11px', border: 'none', background: 'transparent', fontSize: 11,
                fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                color: rightTab === tab ? '#d4b08c' : '#4a4542',
                borderBottom: rightTab === tab ? '2px solid #d4b08c' : '2px solid transparent',
              }}>{tab}</button>
            ))}

            <div style={{ flex: 1 }} />

            {artifact && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(212,176,140,0.1)', color: '#d4b08c', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>{artifact.type}</span>
                <span style={{ fontSize: 11, color: '#57534e' }}>{artifact.title}</span>
              </div>
            )}

            {isStreaming && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
                  boxShadow: '0 0 6px #22c55e55',
                  animation: 'pgPulse 1s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 10, color: '#4ade80' }}>Streaming</span>
              </div>
            )}
          </div>

          {/* Right body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {rightTab === 'preview' && <ArtifactPreview artifact={artifact} />}

            {rightTab === 'source' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {artifact ? (
                  <pre style={{
                    fontFamily: '"SF Mono","Fira Code",monospace', fontSize: 11, color: '#d4b08c',
                    lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: '#1a1917', padding: 16, borderRadius: 8, margin: 0,
                  }}>{artifact.content}</pre>
                ) : (
                  <p style={{ color: '#3a3733', fontSize: 13 }}>No artifact yet — hit Run.</p>
                )}
              </div>
            )}

            {rightTab === 'console' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <pre style={{
                  fontFamily: '"SF Mono","Fira Code",monospace', fontSize: 11, color: '#a8a29e',
                  lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                }}>
                  {streamText
                    ? streamText
                    : <span style={{ color: '#3a3733' }}>Output will stream here when you Run...</span>
                  }
                  {isStreaming && (
                    <span style={{ color: '#d4b08c', animation: 'pgBlink 0.6s step-end infinite' }}>▌</span>
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pgBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pgPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────

function addMsgBtnStyle(color: string): React.CSSProperties {
  return {
    flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${color}20`,
    background: `${color}0a`, color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  };
}

function ConfigSlider({
  label, value, min, max, step, display, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void; hint?: [string, string];
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#a8a29e' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d4b08c', fontFamily: 'monospace' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#d4b08c' }} />
      {hint && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: '#3a3733' }}>{hint[0]}</span>
          <span style={{ fontSize: 9, color: '#3a3733' }}>{hint[1]}</span>
        </div>
      )}
    </div>
  );
}

function ConfigToggleRow({ label, desc, on }: { label: string; desc: string; on: boolean }) {
  const [enabled, setEnabled] = React.useState(on);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a8a29e' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#44403c', marginTop: 2 }}>{desc}</div>
      </div>
      <ToggleSwitch on={enabled} onChange={() => setEnabled(v => !v)} />
    </div>
  );
}
