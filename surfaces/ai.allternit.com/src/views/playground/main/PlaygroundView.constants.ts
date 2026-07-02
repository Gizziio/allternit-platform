import { TemplateDefinition } from "./PlaygroundView.types";

export const TEMPLATES: TemplateDefinition[] = [
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
  body { font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f0f0f; color: #e5e5e5; min-height: 100vh; padding: 24px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #d4b08c; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .card { background: #1c1917; border: 1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent); border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
  .card:hover { border-color: rgba(212,176,140,0.4); }
  .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #78716c; margin-bottom: 8px; }
  .card .value { font-size: 32px; font-weight: 800; color: #d4b08c; }
  .card .sub { font-size: 12px; color: #57534e; margin-top: 4px; }
  .chart-area { background: #1c1917; border: 1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent); border-radius: 12px; padding: 20px; }
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; margin-top: 16px; }
  .bar { flex: 1; background: color-mix(in srgb, var(--accent-primary) 15%, transparent); border-radius: 4px 4px 0 0; position: relative; transition: background 0.2s; cursor: pointer; }
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
  body { font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0f0f0f; color:#e5e5e5; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px; }
  .row { display:flex; gap:20px; flex-wrap:wrap; justify-content:center; }
  .card { width:210px; border-radius:16px; padding:24px; }
  .v1 { background:#1c1917; border:1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent); }
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
  .v1 .btn { background:color-mix(in srgb, var(--accent-primary) 15%, transparent); color:#d4b08c; }
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.wrap{background:#1c1917;border:1px solid rgba(212,176,140,.15);border-radius:16px;padding:24px}h2{color:#d4b08c;font-size:16px;font-weight:700;margin-bottom:20px}</style>
</head><body><div class="wrap"><h2>Monthly Revenue</h2><canvas id="c" width="480" height="240"></canvas></div>
<script>
const data=[12,18,15,22,28,31],labels=['Jan','Feb','Mar','Apr','May','Jun'];
const c=document.getElementById('c'),ctx=c.getContext('2d');
const W=c.width,H=c.height,pad={top:20,right:20,bottom:40,left:50};
const cw=W-pad.left-pad.right,ch=H-pad.top-pad.bottom,max=Math.max(...data)*1.2;
const x=i=>pad.left+(i/(data.length-1))*cw,y=v=>pad.top+ch-(v/max)*ch;
ctx.strokeStyle='rgba(212,176,140,.08)';ctx.lineWidth=1;
[.25,.5,.75,1].forEach(t=>{ctx.beginPath();ctx.moveTo(pad.left,pad.top+ch*(1-t));ctx.lineTo(W-pad.right,pad.top+ch*(1-t));ctx.stroke();ctx.fillStyle='var(--ui-text-muted)';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText('$'+Math.round(max*t)+'k',pad.left-6,pad.top+ch*(1-t)+4);});
const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);grad.addColorStop(0,'rgba(212,176,140,.3)');grad.addColorStop(1,'rgba(212,176,140,0)');
ctx.beginPath();ctx.moveTo(x(0),y(data[0]));data.forEach((v,i)=>{if(i>0)ctx.lineTo(x(i),y(v));});ctx.lineTo(x(data.length-1),pad.top+ch);ctx.lineTo(x(0),pad.top+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
ctx.beginPath();ctx.strokeStyle='var(--accent-primary)';ctx.lineWidth=2.5;ctx.lineJoin='round';data.forEach((v,i)=>{i===0?ctx.moveTo(x(i),y(v)):ctx.lineTo(x(i),y(v));});ctx.stroke();
data.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),y(v),5,0,Math.PI*2);ctx.fillStyle='var(--accent-primary)';ctx.fill();ctx.fillStyle='var(--accent-primary)';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('$'+v+'k',x(i),y(v)-12);ctx.fillStyle='var(--ui-text-muted)';ctx.font='10px sans-serif';ctx.fillText(labels[i],x(i),H-12);});
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
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;padding:24px}h2{color:#d4b08c;font-size:18px;margin-bottom:20px;font-weight:700}.row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.box{background:#1c1917;border-radius:10px;padding:16px}.before{border-left:3px solid #ef4444}.after{border-left:3px solid #22c55e}.label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}.before .label{color:#ef4444}.after .label{color:#22c55e}.text{font-size:14px;line-height:1.6}.note{background:rgba(212,176,140,.08);border-radius:8px;padding:12px 16px;border-left:3px solid #d4b08c}.note p{font-size:12px;color:#a8a29e;line-height:1.5}.note strong{color:#d4b08c}</style></head><body><h2>Copy Review</h2><div class="row"><div class="box before"><div class="label">Before</div><div class="text">"Click here to submit your information to proceed to the next step."</div></div><div class="box after"><div class="label">After</div><div class="text">"Continue"</div></div></div><div class="note"><p><strong>Reduction:</strong> 13 words → 1 word (92% shorter)</p><p><strong>Why:</strong> "Click here" is redundant on a button. "Submit your information" is verbose and clinical. "Proceed to the next step" is bureaucratic. "Continue" is friendly, universally understood, and respects the user's intelligence.</p></div></body></html>`,
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
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;font-family:var(--font-mono);color:#e5e5e5;padding:24px}h2{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#d4b08c;font-size:18px;margin-bottom:20px}.diff{background:#1c1917;border-radius:10px;overflow:hidden;border:1px solid rgba(212,176,140,.1)}.dh{display:grid;grid-template-columns:1fr 1fr;background:#0f0f0f;padding:8px 16px}.dh span{font-size:11px;color:#57534e;font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.line{display:grid;grid-template-columns:1fr 1fr}.cell{padding:2px 16px;font-size:12px;line-height:1.7}.del{background:rgba(239,68,68,.1);color:#fca5a5}.add{background:rgba(34,197,94,.1);color:#86efac}.ctx{color:#57534e}.sum{background:rgba(212,176,140,.06);border-radius:10px;padding:16px;margin-top:16px;border:1px solid rgba(212,176,140,.15)}.sum h3{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#d4b08c;margin-bottom:8px}.sum p{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#a8a29e;line-height:1.5}</style></head><body><h2>Diff Review — var → const</h2><div class="diff"><div class="dh"><span>Before</span><span>After</span></div><div class="line"><div class="cell del">- var count = 0;</div><div class="cell add">+ const count = 0;</div></div><div class="line"><div class="cell del">- var name = getUser();</div><div class="cell add">+ const name = getUser();</div></div><div class="line"><div class="cell del">- var items = fetch();</div><div class="cell add">+ const items = fetch();</div></div><div class="line"><div class="cell ctx">  processItems(items);</div><div class="cell ctx">  processItems(items);</div></div></div><div class="sum"><h3>Summary</h3><p>The transition from var to const/let improves code reliability by introducing block scoping and preventing reassignment where inappropriate. All replacements are correct and do not alter functional logic.</p></div></body></html>`,
    },
  },
];
