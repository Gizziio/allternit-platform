// ============================================================================
// Artifact Templates
// ============================================================================
// Curated, production-quality templates used for:
//   1. Few-shot injection into the LLM system prompt (quality reference)
//   2. Instant gallery launch (zero-LLM "Open" button)
//
// All HTML templates are 100% self-contained — no CDN dependencies.
// Required by sandbox="allow-scripts" (no allow-same-origin).
// ============================================================================

export type ArtifactKind = 'html' | 'svg' | 'mermaid' | 'jsx';

export type ArtifactCategory =
  | 'game'
  | 'tool'
  | 'chart'
  | 'animation'
  | 'diagram'
  | 'ui'
  | 'productivity';

export interface ArtifactTemplate {
  id: string;
  title: string;
  description: string;
  kind: ArtifactKind;
  category: ArtifactCategory;
  tags: string[];
  /** Prompt shown to LLM when remixing */
  prompt: string;
  /** Actual working content for instant launch + few-shot injection */
  content: string;
}

// ============================================================================
// Templates
// ============================================================================

const KANBAN_BOARD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kanban Board</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;padding:20px}
h1{font-size:18px;font-weight:600;margin-bottom:20px;color:#f1f5f9}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;height:calc(100vh - 80px)}
.col{background:#1a1d27;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;border:1px solid #2d3148}
.col-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.col-title{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.col-count{font-size:11px;background:#2d3148;border-radius:99px;padding:2px 8px;color:#94a3b8}
.todo .col-title{color:#94a3b8}
.inprog .col-title{color:#60a5fa}
.done .col-title{color:#34d399}
.card{background:#252836;border:1px solid #2d3148;border-radius:8px;padding:12px;cursor:pointer;transition:all .15s;font-size:13px;line-height:1.5;user-select:none}
.card:hover{border-color:#4f5a8a;transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3)}
.card-text{color:#cbd5e1}
.card-actions{display:flex;gap:4px;margin-top:10px}
.btn-move{font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid #3d4464;background:transparent;color:#94a3b8;cursor:pointer;transition:all .12s}
.btn-move:hover{background:#3d4464;color:#e2e8f0}
.btn-del{font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid #4d2020;background:transparent;color:#f87171;cursor:pointer;transition:all .12s}
.btn-del:hover{background:#4d2020}
.add-row{display:flex;gap:6px;margin-top:4px}
.add-input{flex:1;background:#1a1d27;border:1px solid #2d3148;border-radius:6px;padding:8px 10px;color:#e2e8f0;font-size:13px;outline:none}
.add-input:focus{border-color:#4f5a8a}
.add-btn{padding:8px 12px;background:#3b4fd8;border:none;border-radius:6px;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap}
.add-btn:hover{background:#4f62e8}
</style>
</head>
<body>
<h1>Kanban Board</h1>
<div class="board">
  <div class="col todo" id="todo">
    <div class="col-header"><span class="col-title">To Do</span><span class="col-count" id="cnt-todo">0</span></div>
    <div class="cards" id="cards-todo"></div>
    <div class="add-row"><input class="add-input" id="inp-todo" placeholder="Add task..." /><button class="add-btn" onclick="addCard('todo')">Add</button></div>
  </div>
  <div class="col inprog" id="inprog">
    <div class="col-header"><span class="col-title">In Progress</span><span class="col-count" id="cnt-inprog">0</span></div>
    <div class="cards" id="cards-inprog"></div>
    <div class="add-row"><input class="add-input" id="inp-inprog" placeholder="Add task..." /><button class="add-btn" onclick="addCard('inprog')">Add</button></div>
  </div>
  <div class="col done" id="done">
    <div class="col-header"><span class="col-title">Done</span><span class="col-count" id="cnt-done">0</span></div>
    <div class="cards" id="cards-done"></div>
    <div class="add-row"><input class="add-input" id="inp-done" placeholder="Add task..." /><button class="add-btn" onclick="addCard('done')">Add</button></div>
  </div>
</div>
<script>
const COLS=['todo','inprog','done'];
const LABELS={'todo':'To Do','inprog':'In Progress','done':'Done'};
const NEXT={'todo':'inprog','inprog':'done','done':null};
const PREV={'todo':null,'inprog':'todo','done':'inprog'};
let data=JSON.parse(localStorage.getItem('kanban')||'{"todo":["Design mockups","Write unit tests","Update docs"],"inprog":["Implement API endpoint","Fix login bug"],"done":["Project setup","Database schema"]}');

function save(){localStorage.setItem('kanban',JSON.stringify(data));}

function render(){
  COLS.forEach(col=>{
    const el=document.getElementById('cards-'+col);
    el.innerHTML='';
    data[col].forEach((text,i)=>{
      const d=document.createElement('div');
      d.className='card';
      const prevCol=PREV[col], nextCol=NEXT[col];
      d.innerHTML='<div class="card-text">'+text+'</div><div class="card-actions">'
        +(prevCol?'<button class="btn-move" onclick="move(\''+col+'\','+i+',\''+prevCol+'\')">← '+LABELS[prevCol]+'</button>':'')
        +(nextCol?'<button class="btn-move" onclick="move(\''+col+'\','+i+',\''+nextCol+'\')">'+LABELS[nextCol]+' →</button>':'')
        +'<button class="btn-del" onclick="del(\''+col+'\','+i+')">Remove</button></div>';
      el.appendChild(d);
    });
    document.getElementById('cnt-'+col).textContent=data[col].length;
  });
}

function move(from,i,to){const[item]=data[from].splice(i,1);data[to].push(item);save();render();}
function del(col,i){data[col].splice(i,1);save();render();}

function addCard(col){
  const inp=document.getElementById('inp-'+col);
  const val=inp.value.trim();
  if(!val)return;
  data[col].push(val);
  inp.value='';
  save();render();
}

document.querySelectorAll('.add-input').forEach(inp=>{
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){const col=inp.id.replace('inp-','');addCard(col);}});
});

render();
<\/script>
</body>
</html>`;

const REGEX_TESTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Regex Tester</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;height:100vh;display:flex;flex-direction:column;padding:18px;gap:14px}
label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px;display:block}
.row{display:flex;gap:10px;align-items:center}
.pattern-wrap{display:flex;align-items:center;background:#1a1d27;border:1px solid #2d3148;border-radius:8px;overflow:hidden;flex:1}
.slash{padding:0 10px;color:#4f5a8a;font-size:18px;font-family: var(--font-mono);user-select:none}
#pattern{flex:1;background:transparent;border:none;padding:10px 0;color:#e2e8f0;font-size:14px;font-family: var(--font-mono);outline:none}
.flags-row{display:flex;gap:8px}
.flag-btn{padding:5px 12px;border-radius:6px;border:1px solid #2d3148;background:transparent;color:#94a3b8;cursor:pointer;font-size:12px;font-weight:600;transition:all .12s}
.flag-btn.active{background:#3b4fd8;border-color:#3b4fd8;color:#fff}
.textarea-wrap{flex:1;position:relative;min-height:100px}
#teststr{width:100%;height:100%;min-height:120px;background:#1a1d27;border:1px solid #2d3148;border-radius:8px;padding:10px;color:transparent;caret-color:#e2e8f0;font-size:14px;font-family: var(--font-mono);outline:none;resize:none;position:relative;z-index:2}
#highlight{position:absolute;inset:0;padding:10px;font-size:14px;font-family: var(--font-mono);line-height:1.5;white-space:pre-wrap;word-break:break-all;pointer-events:none;border-radius:8px;color:#e2e8f0}
mark{background:#f59e0b40;color:#fbbf24;border-radius:2px}
.results{background:#1a1d27;border:1px solid #2d3148;border-radius:8px;padding:12px;flex:1;overflow-y:auto;max-height:180px}
.match-item{font-size:12px;font-family: var(--font-mono);padding:4px 8px;border-radius:4px;margin-bottom:4px;background:#252836;display:flex;gap:12px}
.match-idx{color:#60a5fa;min-width:50px}
.match-val{color:#34d399;font-weight:600}
.match-pos{color:#94a3b8}
.status{font-size:12px;padding:6px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:6px}
.status.ok{background:#052e16;color:#4ade80;border:1px solid #166534}
.status.err{background:#2d0a0a;color:#f87171;border:1px solid #7f1d1d}
.status.none{background:#1e293b;color:#94a3b8;border:1px solid #334155}
</style>
</head>
<body>
<div>
  <label>Pattern</label>
  <div class="row">
    <div class="pattern-wrap"><span class="slash">/</span><input id="pattern" spellcheck="false" placeholder="([a-z]+)\d+" /><span class="slash">/</span></div>
  </div>
</div>
<div>
  <label>Flags</label>
  <div class="flags-row">
    <button class="flag-btn active" data-flag="g">g</button>
    <button class="flag-btn active" data-flag="i">i</button>
    <button class="flag-btn" data-flag="m">m</button>
    <button class="flag-btn" data-flag="s">s</button>
  </div>
</div>
<div style="flex:1;position:relative">
  <label>Test String</label>
  <div class="textarea-wrap">
    <div id="highlight"></div>
    <textarea id="teststr" spellcheck="false">Hello world foo123 bar456 REGEX tester test99 abc007</textarea>
  </div>
</div>
<div id="status-wrap"><span class="status none" id="status">No pattern</span></div>
<div>
  <label>Matches</label>
  <div class="results" id="results"><div style="color:#475569;font-size:12px">Matches will appear here</div></div>
</div>
<script>
const patEl=document.getElementById('pattern');
const testEl=document.getElementById('teststr');
const hlEl=document.getElementById('highlight');
const resultsEl=document.getElementById('results');
const statusEl=document.getElementById('status');
let activeFlags=new Set(['g','i']);

document.querySelectorAll('.flag-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const f=btn.dataset.flag;
    if(activeFlags.has(f)){activeFlags.delete(f);btn.classList.remove('active');}
    else{activeFlags.add(f);btn.classList.add('active');}
    run();
  });
});

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function run(){
  const pat=patEl.value;
  const txt=testEl.value;
  if(!pat){hlEl.innerHTML=esc(txt);statusEl.className='status none';statusEl.textContent='No pattern';resultsEl.innerHTML='<div style="color:#475569;font-size:12px">Matches will appear here</div>';return;}
  let rx;
  try{rx=new RegExp(pat,[...activeFlags].join(''));}
  catch(e){hlEl.innerHTML=esc(txt);statusEl.className='status err';statusEl.textContent='Invalid: '+e.message;resultsEl.innerHTML='';return;}
  const gFlags=[...activeFlags,'g'].filter((v,i,a)=>a.indexOf(v)===i).join('');
  const allM=[...txt.matchAll(new RegExp(pat,gFlags))];
  let hi='',last=0;
  allM.forEach(m=>{
    hi+=esc(txt.slice(last,m.index));
    hi+='<mark>'+esc(m[0])+'</mark>';
    last=m.index+m[0].length;
  });
  hi+=esc(txt.slice(last));
  hlEl.innerHTML=hi;
  statusEl.className='status ok';
  statusEl.textContent=allM.length+' match'+(allM.length!==1?'es':'');
  resultsEl.innerHTML=allM.length?allM.map((m,i)=>{
    const groups=m.slice(1).map((g,gi)=>g!==undefined?'<span class="match-pos"> grp'+(gi+1)+':"'+esc(g)+'"</span>':'').join('');
    return '<div class="match-item"><span class="match-idx">Match '+(i+1)+'</span><span class="match-val">"'+esc(m[0])+'"</span><span class="match-pos">pos '+m.index+'</span>'+groups+'</div>';
  }).join(''):'<div style="color:#94a3b8;font-size:12px">No matches</div>';
}

testEl.addEventListener('input',run);
patEl.addEventListener('input',run);
testEl.addEventListener('scroll',()=>{hlEl.scrollTop=testEl.scrollTop;});
run();
<\/script>
</body>
</html>`;

const MARKDOWN_EDITOR = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Markdown Editor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;height:100vh;display:flex;flex-direction:column}
.toolbar{display:flex;align-items:center;gap:6px;padding:10px 16px;background:#1a1d27;border-bottom:1px solid #2d3148;flex-shrink:0}
.toolbar h1{font-size:14px;font-weight:600;margin-right:8px;color:#94a3b8}
.tb-btn{padding:4px 10px;border-radius:5px;border:1px solid #2d3148;background:transparent;color:#94a3b8;cursor:pointer;font-size:12px;font-weight:600;font-family: var(--font-mono);transition:all .12s}
.tb-btn:hover{background:#252836;color:#e2e8f0}
.stats{margin-left:auto;font-size:11px;color:#475569}
.panes{display:flex;flex:1;overflow:hidden}
.pane{flex:1;display:flex;flex-direction:column;overflow:hidden}
.pane-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569;padding:8px 14px;background:#13151f;border-bottom:1px solid #1e2235;flex-shrink:0}
.divider{width:1px;background:#1e2235;flex-shrink:0}
#editor{flex:1;background:#13151f;border:none;padding:14px;color:#e2e8f0;font-size:14px;font-family: var(--font-mono);line-height:1.7;outline:none;resize:none;overflow-y:auto}
#preview{flex:1;padding:14px 18px;overflow-y:auto;line-height:1.7;font-size:14px}
#preview h1,#preview h2,#preview h3,#preview h4{margin:1em 0 .4em;font-weight:600;color:#f1f5f9}
#preview h1{font-size:1.6em;border-bottom:1px solid #1e2235;padding-bottom:.3em}
#preview h2{font-size:1.3em;border-bottom:1px solid #1e2235;padding-bottom:.2em}
#preview h3{font-size:1.1em}
#preview p{margin:.6em 0;color:#cbd5e1}
#preview code{background:#1e2235;padding:2px 6px;border-radius:4px;font-family: var(--font-mono);font-size:13px;color:#7dd3fc}
#preview pre{background:#1a1d27;border:1px solid #2d3148;border-radius:8px;padding:12px;overflow-x:auto;margin:.8em 0}
#preview pre code{background:none;padding:0;color:#e2e8f0}
#preview blockquote{border-left:3px solid #3b4fd8;padding:.3em 1em;margin:.6em 0;color:#94a3b8;background:#13151f}
#preview ul,#preview ol{padding-left:1.5em;margin:.5em 0}
#preview li{margin:.2em 0;color:#cbd5e1}
#preview a{color:#60a5fa;text-decoration:none}
#preview a:hover{text-decoration:underline}
#preview table{border-collapse:collapse;width:100%;margin:.8em 0}
#preview th,#preview td{border:1px solid #2d3148;padding:6px 12px;text-align:left}
#preview th{background:#1a1d27;font-weight:600}
#preview hr{border:none;border-top:1px solid #2d3148;margin:1em 0}
#preview strong{color:#f1f5f9;font-weight:700}
#preview em{color:#c4b5fd;font-style:italic}
</style>
</head>
<body>
<div class="toolbar">
  <h1>Markdown Editor</h1>
  <button class="tb-btn" onclick="ins('**','**')"><b>B</b></button>
  <button class="tb-btn" onclick="ins('*','*')"><i>I</i></button>
  <button class="tb-btn" onclick="ins('\`','\`')">Code</button>
  <button class="tb-btn" onclick="insLine('# ')">H1</button>
  <button class="tb-btn" onclick="insLine('## ')">H2</button>
  <button class="tb-btn" onclick="insLine('- ')">List</button>
  <button class="tb-btn" onclick="insLine('> ')">Quote</button>
  <span class="stats" id="stats">0 words</span>
</div>
<div class="panes">
  <div class="pane"><div class="pane-label">Markdown</div><textarea id="editor" spellcheck="false"></textarea></div>
  <div class="divider"></div>
  <div class="pane"><div class="pane-label">Preview</div><div id="preview"></div></div>
</div>
<script>
const editor=document.getElementById('editor');
const preview=document.getElementById('preview');
const stats=document.getElementById('stats');

const DEFAULT='# Welcome to Markdown Editor\n\nA **live preview** markdown editor with _no dependencies_.\n\n## Features\n\n- Real-time preview as you type\n- Syntax highlighting for code blocks\n- Support for tables, blockquotes, and more\n\n## Code Example\n\n\`\`\`javascript\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\`\`\`\n\n## Table\n\n| Name | Type | Description |\n|------|------|-------------|\n| id   | int  | Primary key |\n| name | text | Full name   |\n\n> "The best tool is the one you actually use."\n\n---\n\nTry editing this text on the **left** side!\n';

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function md(src){
  let s=esc(src);
  s=s.replace(/\`\`\`(\w*)\n?([\s\S]*?)\`\`\`/g,(_,l,c)=>'<pre><code>'+c.trim()+'</code></pre>');
  s=s.replace(/^###### (.+)$/gm,'<h6>$1</h6>');
  s=s.replace(/^##### (.+)$/gm,'<h5>$1</h5>');
  s=s.replace(/^#### (.+)$/gm,'<h4>$1</h4>');
  s=s.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  s=s.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  s=s.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  s=s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  s=s.replace(/^---+$/gm,'<hr>');
  s=s.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/\*(.+?)\*/g,'<em>$1</em>');
  s=s.replace(/_(.+?)_/g,'<em>$1</em>');
  s=s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
  s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  s=s.replace(/((?:\|.+\|\n)+)/g,t=>{
    const rows=t.trim().split('\n');
    const isHdr=rows.length>1&&/^\|[\s:-]+\|/.test(rows[1]);
    return '<table>'+rows.map((r,i)=>{
      if(i===1&&isHdr)return '';
      const cells=r.split('|').slice(1,-1);
      const tag=i===0&&isHdr?'th':'td';
      return '<tr>'+cells.map(c=>'<'+tag+'>'+c.trim()+'</'+tag+'>').join('')+'</tr>';
    }).join('')+'</table>';
  });
  s=s.replace(/((?:^- .+\n?)+)/gm,t=>'<ul>'+t.trim().split('\n').map(l=>'<li>'+l.slice(2)+'</li>').join('')+'</ul>');
  s=s.replace(/((?:^\d+\. .+\n?)+)/gm,t=>'<ol>'+t.trim().split('\n').map(l=>'<li>'+l.replace(/^\d+\. /,'')+'</li>').join('')+'</ol>');
  s=s.split(/\n\n+/).map(b=>b.startsWith('<')?b:'<p>'+b.replace(/\n/g,'<br>')+'</p>').join('\n');
  return s;
}

function update(){
  const val=editor.value;
  preview.innerHTML=md(val);
  const words=val.trim().split(/\s+/).filter(Boolean).length;
  stats.textContent=words+' words · '+val.length+' chars';
}

function ins(before,after){
  const s=editor.selectionStart,e=editor.selectionEnd;
  const sel=editor.value.slice(s,e)||'text';
  editor.value=editor.value.slice(0,s)+before+sel+after+editor.value.slice(e);
  editor.focus();update();
}
function insLine(prefix){
  const s=editor.selectionStart;
  const lineStart=editor.value.lastIndexOf('\n',s-1)+1;
  editor.value=editor.value.slice(0,lineStart)+prefix+editor.value.slice(lineStart);
  editor.focus();update();
}

editor.value=DEFAULT;
editor.addEventListener('input',update);
update();
<\/script>
</body>
</html>`;

const JSON_FORMATTER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JSON Formatter</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;height:100vh;display:flex;flex-direction:column}
.toolbar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:#1a1d27;border-bottom:1px solid #2d3148;flex-shrink:0}
.toolbar h1{font-size:14px;font-weight:600;color:#94a3b8;margin-right:4px}
.btn{padding:5px 14px;border-radius:6px;border:1px solid #2d3148;background:transparent;color:#94a3b8;cursor:pointer;font-size:12px;font-weight:600;transition:all .12s}
.btn:hover{background:#252836;color:#e2e8f0}
.btn.primary{background:#3b4fd8;border-color:#3b4fd8;color:#fff}
.btn.primary:hover{background:#4f62e8}
.status{font-size:12px;padding:4px 10px;border-radius:5px;margin-left:auto}
.status.ok{background:#052e16;color:#4ade80;border:1px solid #166534}
.status.err{background:#2d0a0a;color:#f87171;border:1px solid #7f1d1d}
.status.idle{background:#1e293b;color:#94a3b8;border:1px solid #334155}
.panes{display:flex;flex:1;overflow:hidden}
.pane{flex:1;display:flex;flex-direction:column;overflow:hidden}
.pane-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569;padding:8px 14px;background:#13151f;border-bottom:1px solid #1e2235;flex-shrink:0}
.divider{width:1px;background:#1e2235}
#input{flex:1;background:#13151f;border:none;padding:14px;color:#cbd5e1;font-size:13px;font-family: var(--font-mono);line-height:1.6;outline:none;resize:none}
#output{flex:1;padding:14px;overflow:auto;font-size:13px;font-family: var(--font-mono);line-height:1.6;background:#0f1117}
.jkey{color:#60a5fa}
.jstr{color:#34d399}
.jnum{color:#f59e0b}
.jbool{color:#c084fc}
.jnull{color:#94a3b8;font-style:italic}
.toggle{cursor:pointer;user-select:none;color:#64748b;margin-right:4px;font-size:11px}
.toggle:hover{color:#94a3b8}
.collapsible{overflow:hidden}
.collapsed>.collapsible{display:none}
.collapsed>.ellipsis{display:inline}
.ellipsis{display:none;color:#64748b}
</style>
</head>
<body>
<div class="toolbar">
  <h1>JSON Formatter</h1>
  <button class="btn primary" onclick="format()">Format</button>
  <button class="btn" onclick="minify()">Minify</button>
  <button class="btn" onclick="copyOut()">Copy</button>
  <button class="btn" onclick="clearAll()">Clear</button>
  <span class="status idle" id="status">Paste JSON to begin</span>
</div>
<div class="panes">
  <div class="pane"><div class="pane-label">Input</div><textarea id="input" spellcheck="false" placeholder="Paste JSON here..."></textarea></div>
  <div class="divider"></div>
  <div class="pane"><div class="pane-label">Formatted Output</div><div id="output"></div></div>
</div>
<script>
const inputEl=document.getElementById('input');
const outputEl=document.getElementById('output');
const statusEl=document.getElementById('status');

const SAMPLE='{"users":[{"id":1,"name":"Alice","role":"admin","active":true,"score":98.5},{"id":2,"name":"Bob","role":"user","active":false,"score":null}],"meta":{"total":2,"page":1,"perPage":10}}';
inputEl.value=SAMPLE;

function setStatus(ok,msg){statusEl.className='status '+(ok?'ok':'err');statusEl.textContent=msg;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderNode(v,depth){
  depth=depth||0;
  if(v===null)return '<span class="jnull">null</span>';
  if(typeof v==='boolean')return '<span class="jbool">'+v+'</span>';
  if(typeof v==='number')return '<span class="jnum">'+v+'</span>';
  if(typeof v==='string')return '<span class="jstr">"'+esc(v)+'"</span>';
  if(Array.isArray(v)){
    if(v.length===0)return '[]';
    const id='n'+Math.random().toString(36).slice(2);
    const items=v.map((item,i)=>'<div style="padding-left:18px">'+renderNode(item,depth+1)+(i<v.length-1?',':'')+'</div>').join('');
    return '<span class="toggle" onclick="tog(\''+id+'\')">&#9660;</span>[<span class="ellipsis">...]</span><span class="collapsible" id="'+id+'">'+items+'</span>]';
  }
  if(typeof v==='object'){
    const keys=Object.keys(v);
    if(keys.length===0)return '{}';
    const id='n'+Math.random().toString(36).slice(2);
    const items=keys.map((k,i)=>'<div style="padding-left:18px"><span class="jkey">"'+esc(k)+'"</span>: '+renderNode(v[k],depth+1)+(i<keys.length-1?',':'')+'</div>').join('');
    return '<span class="toggle" onclick="tog(\''+id+'\')">&#9660;</span>{<span class="ellipsis">...}</span><span class="collapsible" id="'+id+'">'+items+'</span>}';
  }
  return String(v);
}

function tog(id){
  const el=document.getElementById(id);
  el.parentElement.classList.toggle('collapsed');
  const t=el.parentElement.querySelector('.toggle');
  if(t)t.textContent=el.parentElement.classList.contains('collapsed')?'▶':'▼';
}

function format(){
  try{
    const parsed=JSON.parse(inputEl.value);
    outputEl.innerHTML=renderNode(parsed,0);
    setStatus(true,'Valid JSON · '+inputEl.value.length+' bytes');
  }catch(e){
    outputEl.innerHTML='<span style="color:#f87171">'+esc(e.message)+'</span>';
    setStatus(false,e.message.slice(0,60));
  }
}

function minify(){
  try{const p=JSON.parse(inputEl.value);inputEl.value=JSON.stringify(p);setStatus(true,'Minified');format();}
  catch(e){setStatus(false,'Invalid JSON');}
}

function copyOut(){
  try{const p=JSON.parse(inputEl.value);navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(p,null,2));setStatus(true,'Copied!');}
  catch(e){setStatus(false,'Invalid JSON');}
}

function clearAll(){inputEl.value='';outputEl.innerHTML='';statusEl.className='status idle';statusEl.textContent='Paste JSON to begin';}

inputEl.addEventListener('input',()=>{if(inputEl.value.trim())format();});
format();
<\/script>
</body>
</html>`;

const KPI_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KPI Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0d14;color:#e2e8f0;min-height:100vh;padding:20px}
h1{font-size:16px;font-weight:600;color:#94a3b8;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.card{background:#13151f;border:1px solid #1e2235;border-radius:12px;padding:18px;cursor:pointer;transition:border-color .15s}
.card:hover{border-color:#2d3557}
.card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.card-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569}
.badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;display:inline-flex;align-items:center;gap:3px}
.up{background:#052e16;color:#4ade80;border:1px solid #166534}
.down{background:#2d0a0a;color:#f87171;border:1px solid #7f1d1d}
.flat{background:#1e293b;color:#94a3b8;border:1px solid #334155}
.card-value{font-size:28px;font-weight:700;letter-spacing:-.03em;margin-bottom:2px}
.card-sub{font-size:12px;color:#475569;margin-bottom:12px}
canvas{width:100%!important;display:block}
.edit-overlay{display:none;gap:8px;margin-top:12px;align-items:center}
.card.editing .edit-overlay{display:flex}
.edit-input{flex:1;background:#0b0d14;border:1px solid #2d3148;border-radius:6px;padding:6px 10px;color:#e2e8f0;font-size:13px;outline:none}
.save-btn{padding:6px 12px;background:#3b4fd8;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer}
</style>
</head>
<body>
<h1>KPI Dashboard — click any card to edit value</h1>
<div class="grid" id="grid"></div>
<script>
const metrics=[
  {label:'Monthly Revenue',value:84320,prev:76100,format:'$',unit:'',color:'var(--status-info)',data:[62000,67000,71000,68000,73000,78000,80000,76000,82000,79000,83000,84320]},
  {label:'Active Users',value:12847,prev:11200,format:'',unit:'',color:'var(--status-success)',data:[9200,9800,10100,10600,11000,10700,11400,11800,12100,12400,12600,12847]},
  {label:'Avg Session (min)',value:4.7,prev:4.2,format:'',unit:'min',color:'var(--status-warning)',data:[3.1,3.4,3.8,3.6,4.0,3.9,4.1,4.4,4.3,4.5,4.6,4.7]},
  {label:'Churn Rate',value:2.1,prev:2.8,format:'',unit:'%',color:'var(--status-error)',data:[4.2,3.9,3.5,3.8,3.2,3.0,2.8,2.7,2.5,2.3,2.2,2.1]},
];

function fmt(m){return m.format==='$'?'$'+m.value.toLocaleString():m.value+(m.unit||'');}

function trend(m){
  const pct=((m.value-m.prev)/m.prev*100).toFixed(1);
  const cls=pct>0.5?'up':pct<-0.5?'down':'flat';
  return{cls,pct};
}

function drawSparkline(canvas,data,color){
  canvas.width=canvas.offsetWidth||260;canvas.height=40;
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height,pad=2;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>({x:pad+i*(w-2*pad)/(data.length-1),y:h-pad-(v-min)/range*(h-2*pad)}));
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,color+'55');grad.addColorStop(1,color+'00');
  ctx.beginPath();ctx.moveTo(pts[0].x,h);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(pts[pts.length-1].x,h);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
}

function render(){
  const grid=document.getElementById('grid');
  grid.innerHTML='';
  metrics.forEach((m,i)=>{
    const {cls,pct}=trend(m);
    const card=document.createElement('div');
    card.className='card';
    card.innerHTML='<div class="card-header"><span class="card-label">'+m.label+'</span><span class="badge '+cls+'">'+(pct>0?'+':'')+pct+'%</span></div>'
      +'<div class="card-value">'+fmt(m)+'</div>'
      +'<div class="card-sub">vs prev: '+( m.format==='$'?'$'+m.prev.toLocaleString():m.prev+(m.unit||''))+'</div>'
      +'<canvas id="cv'+i+'" height="40"></canvas>'
      +'<div class="edit-overlay"><input class="edit-input" id="ev'+i+'" type="number" step="any" value="'+m.value+'" />'
      +'<button class="save-btn" onclick="saveEdit('+i+')">Save</button></div>';
    card.addEventListener('click',()=>card.classList.toggle('editing'));
    grid.appendChild(card);
    setTimeout(()=>{const cv=document.getElementById('cv'+i);if(cv)drawSparkline(cv,m.data,m.color);},10);
  });
}

function saveEdit(i){
  const v=parseFloat(document.getElementById('ev'+i).value);
  if(!isNaN(v)){metrics[i].prev=metrics[i].value;metrics[i].value=v;metrics[i].data.push(v);metrics[i].data.shift();}
  render();
}

render();
window.addEventListener('resize',()=>metrics.forEach((_,i)=>{const cv=document.getElementById('cv'+i);if(cv)drawSparkline(cv,metrics[i].data,metrics[i].color);}));
<\/script>
</body>
</html>`;

const INVOICE_GENERATOR = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice Generator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0d14;color:#e2e8f0;min-height:100vh;padding:20px}
.layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1100px;margin:0 auto}
.panel{background:#13151f;border:1px solid #1e2235;border-radius:12px;padding:18px;margin-bottom:16px}
h2{font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:14px;text-transform:uppercase;letter-spacing:.06em}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
label{font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em}
input,textarea,select{background:#0b0d14;border:1px solid #1e2235;border-radius:6px;padding:8px 10px;color:#e2e8f0;font-size:13px;outline:none;width:100%;font-family:inherit}
input:focus,textarea:focus,select:focus{border-color:#3b4fd8}
textarea{resize:vertical;min-height:60px}
.items-table{width:100%;border-collapse:collapse;margin-bottom:10px}
.items-table th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569;padding:6px 8px;border-bottom:1px solid #1e2235;text-align:left}
.items-table td{padding:4px}
.items-table input{padding:6px 8px;font-size:13px}
.del-btn{background:transparent;border:none;color:#f87171;cursor:pointer;font-size:16px;padding:4px 8px;border-radius:4px}
.del-btn:hover{background:#2d0a0a}
.add-btn{font-size:12px;padding:6px 12px;background:transparent;border:1px solid #2d3148;border-radius:6px;color:#94a3b8;cursor:pointer;margin-top:6px}
.add-btn:hover{background:#1e2235}
.print-btn{padding:8px 18px;background:#3b4fd8;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-top:12px;width:100%}
.print-btn:hover{background:#4f62e8}
.invoice-preview{background:#fff;color:#1a1a1a;border-radius:8px;padding:28px;font-size:13px;line-height:1.6}
.inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.inv-title{font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:-.03em}
.inv-number{font-size:12px;color:#666;margin-top:4px}
.inv-meta{text-align:right;font-size:12px;color:#444}
.inv-meta strong{color:#1a1a1a}
.inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;padding:16px;background:#f8f9fa;border-radius:8px}
.party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:6px}
.party-name{font-weight:700;font-size:14px;color:#1a1a1a}
.inv-table{width:100%;border-collapse:collapse;margin-bottom:20px}
.inv-table th{background:#1a1a1a;color:#fff;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;text-align:left}
.inv-table td{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px}
.inv-table .text-right{text-align:right}
.inv-totals{text-align:right;font-size:13px}
.inv-totals table{margin-left:auto;min-width:200px}
.inv-totals td{padding:4px 8px}
.inv-totals .total-row td{font-size:15px;font-weight:700;color:#1a1a1a;border-top:2px solid #1a1a1a;padding-top:8px}
.inv-notes{margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#666}
</style>
</head>
<body>
<div class="layout">
<div>
  <div class="panel">
    <h2>Invoice Details</h2>
    <div class="field-row">
      <div class="field"><label>Invoice #</label><input id="inv-num" value="INV-2024-001"></div>
      <div class="field"><label>Date</label><input id="inv-date" type="date"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Due Date</label><input id="due-date" type="date"></div>
      <div class="field"><label>Currency</label>
        <select id="currency"><option value="$">USD $</option><option value="€">EUR €</option><option value="£">GBP £</option></select>
      </div>
    </div>
  </div>
  <div class="panel">
    <h2>Parties</h2>
    <div class="field-row">
      <div class="field"><label>From</label><textarea id="from-addr" rows="3">Acme Studio\n123 Main St\nSan Francisco, CA 94102</textarea></div>
      <div class="field"><label>Bill To</label><textarea id="to-addr" rows="3">Client Corp Inc.\n456 Oak Ave\nNew York, NY 10001</textarea></div>
    </div>
  </div>
  <div class="panel">
    <h2>Line Items</h2>
    <table class="items-table">
      <thead><tr><th style="width:42%">Description</th><th style="width:14%">Qty</th><th style="width:18%">Rate</th><th style="width:16%">Amount</th><th style="width:10%"></th></tr></thead>
      <tbody id="items-body"></tbody>
    </table>
    <button class="add-btn" onclick="addItem()">+ Add Line Item</button>
  </div>
  <div class="panel">
    <div class="field"><label>Tax %</label><input id="tax" type="number" value="10" min="0" max="100"></div>
    <div class="field"><label>Notes</label><textarea id="notes" rows="2">Payment due within 30 days. Bank transfer preferred.</textarea></div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</div>
<div class="panel">
  <h2>Preview</h2>
  <div class="invoice-preview" id="preview"></div>
</div>
</div>
<script>
let items=[{desc:'Web Design & Development',qty:1,rate:3500},{desc:'Monthly Retainer',qty:3,rate:800},{desc:'Domain & Hosting Setup',qty:1,rate:250}];
const today=new Date();
const due=new Date(today);due.setDate(due.getDate()+30);
document.getElementById('inv-date').value=today.toISOString().slice(0,10);
document.getElementById('due-date').value=due.toISOString().slice(0,10);

function addItem(){items.push({desc:'',qty:1,rate:0});renderForm();renderPreview();}
function delItem(i){items.splice(i,1);renderForm();renderPreview();}

function renderForm(){
  document.getElementById('items-body').innerHTML=items.map((item,i)=>
    '<tr><td><input value="'+item.desc.replace(/"/g,'&quot;')+'" oninput="items['+i+'].desc=this.value;renderPreview()" placeholder="Description"></td>'
    +'<td><input type="number" value="'+item.qty+'" min="0" oninput="items['+i+'].qty=parseFloat(this.value)||0;renderPreview()"></td>'
    +'<td><input type="number" value="'+item.rate+'" min="0" step="0.01" oninput="items['+i+'].rate=parseFloat(this.value)||0;renderPreview()"></td>'
    +'<td style="padding:8px;text-align:right;color:#94a3b8;font-size:13px">$'+(item.qty*item.rate).toFixed(2)+'</td>'
    +'<td><button class="del-btn" onclick="delItem('+i+')">×</button></td></tr>'
  ).join('');
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderPreview(){
  const sym=document.getElementById('currency').value;
  const tax=parseFloat(document.getElementById('tax').value)||0;
  const sub=items.reduce((s,i)=>s+i.qty*i.rate,0);
  const taxAmt=sub*tax/100;
  const total=sub+taxAmt;
  const from=esc(document.getElementById('from-addr').value).replace(/\n/g,'<br>');
  const to=esc(document.getElementById('to-addr').value).replace(/\n/g,'<br>');
  const notes=esc(document.getElementById('notes').value);
  document.getElementById('preview').innerHTML=
    '<div class="inv-header"><div><div class="inv-title">INVOICE</div><div class="inv-number">'+esc(document.getElementById('inv-num').value)+'</div></div>'
    +'<div class="inv-meta"><div>Date: <strong>'+document.getElementById('inv-date').value+'</strong></div><div>Due: <strong>'+document.getElementById('due-date').value+'</strong></div></div></div>'
    +'<div class="inv-parties"><div><div class="party-label">From</div><div class="party-name">'+from.split('<br>')[0]+'</div><div>'+from.split('<br>').slice(1).join('<br>')+'</div></div>'
    +'<div><div class="party-label">Bill To</div><div class="party-name">'+to.split('<br>')[0]+'</div><div>'+to.split('<br>').slice(1).join('<br>')+'</div></div></div>'
    +'<table class="inv-table"><thead><tr><th>Description</th><th>Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead><tbody>'
    +items.map(i=>'<tr><td>'+(esc(i.desc)||'—')+'</td><td>'+i.qty+'</td><td class="text-right">'+sym+i.rate.toFixed(2)+'</td><td class="text-right">'+sym+(i.qty*i.rate).toFixed(2)+'</td></tr>').join('')
    +'</tbody></table>'
    +'<div class="inv-totals"><table><tr><td>Subtotal</td><td>'+sym+sub.toFixed(2)+'</td></tr><tr><td>Tax ('+tax+'%)</td><td>'+sym+taxAmt.toFixed(2)+'</td></tr><tr class="total-row"><td>Total</td><td>'+sym+total.toFixed(2)+'</td></tr></table></div>'
    +(notes?'<div class="inv-notes"><strong>Notes:</strong> '+notes+'</div>':'');
}

document.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('input',renderPreview));
renderForm();renderPreview();
<\/script>
</body>
</html>`;

const DATA_TABLE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Data Table</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0d14;color:#e2e8f0;height:100vh;display:flex;flex-direction:column;padding:18px;gap:14px}
.toolbar{display:flex;align-items:center;gap:10px}
h1{font-size:15px;font-weight:600;color:#f1f5f9;margin-right:4px}
.search-wrap{position:relative;flex:1;max-width:280px}
#search{width:100%;background:#1a1d27;border:1px solid #2d3148;border-radius:7px;padding:8px 10px 8px 10px;color:#e2e8f0;font-size:13px;outline:none}
#search:focus{border-color:#3b4fd8}
.meta{margin-left:auto;font-size:12px;color:#475569}
select.col-filter{background:#1a1d27;border:1px solid #2d3148;border-radius:7px;padding:7px 10px;color:#94a3b8;font-size:12px;outline:none}
.table-wrap{flex:1;overflow:auto;border-radius:10px;border:1px solid #1e2235}
table{width:100%;border-collapse:collapse}
thead th{background:#13151f;padding:10px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569;text-align:left;position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap;border-bottom:1px solid #1e2235}
thead th:hover{color:#94a3b8}
thead th.asc::after{content:' ▲';font-size:9px}
thead th.desc::after{content:' ▼';font-size:9px}
tbody tr{border-bottom:1px solid #0f1117;transition:background .1s}
tbody tr:hover{background:#13151f}
tbody td{padding:10px 14px;font-size:13px;color:#cbd5e1}
.badge{display:inline-flex;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600}
.b-active{background:#052e16;color:#4ade80;border:1px solid #166534}
.b-inactive{background:#2d0a0a;color:#f87171;border:1px solid #7f1d1d}
.b-pending{background:#1c1900;color:#fbbf24;border:1px solid #854d0e}
.r-admin{color:#c084fc}
.r-user{color:#60a5fa}
.r-editor{color:#34d399}
.pager{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.pg-btn{padding:5px 11px;border-radius:6px;border:1px solid #2d3148;background:transparent;color:#94a3b8;cursor:pointer;font-size:12px}
.pg-btn:hover:not(:disabled){background:#1e2235;color:#e2e8f0}
.pg-btn:disabled{opacity:.3;cursor:default}
.pg-info{font-size:12px;color:#475569}
</style>
</head>
<body>
<div class="toolbar">
  <h1>Users</h1>
  <input id="search" placeholder="Search name, email, role..." />
  <select class="col-filter" id="sf"><option value="">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Pending">Pending</option></select>
  <select class="col-filter" id="rf"><option value="">All Roles</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="user">User</option></select>
  <span class="meta" id="meta"></span>
</div>
<div class="table-wrap">
  <table><thead><tr id="thead"></tr></thead><tbody id="tbody"></tbody></table>
</div>
<div class="pager">
  <span class="pg-info" id="pg-info"></span>
  <button class="pg-btn" id="prev-btn" onclick="changePage(-1)">← Prev</button>
  <button class="pg-btn" id="next-btn" onclick="changePage(1)">Next →</button>
</div>
<script>
const COLS=['ID','Name','Email','Role','Status','Joined','Score'];
const NAMES=['Alice Chen','Bob Martinez','Carol White','David Kim','Eva Larson','Frank Nguyen','Grace Liu','Henry Park','Iris Brown','Jack Osei','Karen Hall','Liam Torres','Mia Scott','Noah Patel','Olivia Wright','Paul Adams','Quinn Rivera','Rachel Gomez','Sam Lee','Tina Foster'];
const ROLES=['admin','editor','user','user','user'];
const STATUS=['Active','Active','Active','Inactive','Pending'];
const data=NAMES.flatMap((name,idx)=>
  Array.from({length:2},(_,j)=>{
    const i=idx*2+j;
    const role=ROLES[i%ROLES.length];
    const status=STATUS[i%STATUS.length];
    const d=new Date(2023,i%12,1+(i%28));
    return{id:i+1,name:name+(j>0?' II':''),email:name.toLowerCase().replace(/ /g,'.')+i+'@example.com',role,status,joined:d.toISOString().slice(0,10),score:60+Math.round(i*1.5)%40};
  })
).slice(0,40);

let filtered=[...data],sortCol=null,sortDir=1,page=0;
const PAGE=10;

const thead=document.getElementById('thead');
COLS.forEach((col,ci)=>{
  const th=document.createElement('th');
  th.textContent=col;
  th.addEventListener('click',()=>{
    const key=col.toLowerCase();
    if(sortCol===key)sortDir*=-1;else{sortCol=key;sortDir=1;}
    document.querySelectorAll('thead th').forEach((t,i)=>{t.className=i===ci?(sortDir===1?'asc':'desc'):'';});
    render();
  });
  thead.appendChild(th);
});

function render(){
  const q=document.getElementById('search').value.toLowerCase();
  const sf=document.getElementById('sf').value;
  const rf=document.getElementById('rf').value;
  filtered=data.filter(r=>(!q||(r.name+r.email+r.role).toLowerCase().includes(q))&&(!sf||r.status===sf)&&(!rf||r.role===rf));
  if(sortCol)filtered.sort((a,b)=>(a[sortCol]>b[sortCol]?1:a[sortCol]<b[sortCol]?-1:0)*sortDir);
  document.getElementById('meta').textContent=filtered.length+' of '+data.length+' records';
  const maxPage=Math.max(0,Math.ceil(filtered.length/PAGE)-1);
  page=Math.min(page,maxPage);
  const slice=filtered.slice(page*PAGE,(page+1)*PAGE);
  document.getElementById('tbody').innerHTML=slice.map(r=>
    '<tr><td style="color:#475569">#'+r.id+'</td><td style="font-weight:600;color:#f1f5f9">'+r.name+'</td><td style="color:#64748b">'+r.email+'</td>'
    +'<td><span class="r-'+r.role+'">'+r.role+'</span></td>'
    +'<td><span class="badge b-'+r.status.toLowerCase()+'">'+r.status+'</span></td>'
    +'<td>'+r.joined+'</td><td style="font-family:var(--font-mono)">'+r.score+'</td></tr>'
  ).join('');
  document.getElementById('pg-info').textContent='Page '+(page+1)+' of '+(maxPage+1);
  document.getElementById('prev-btn').disabled=page===0;
  document.getElementById('next-btn').disabled=page>=maxPage;
}

function changePage(d){page+=d;render();}
document.getElementById('search').addEventListener('input',()=>{page=0;render();});
document.getElementById('sf').addEventListener('change',()=>{page=0;render();});
document.getElementById('rf').addEventListener('change',()=>{page=0;render();});
render();
<\/script>
</body>
</html>`;

const BUDGET_TRACKER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Budget Tracker</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Allternit Sans',Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0d14;color:#e2e8f0;min-height:100vh;padding:18px}
h1{font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:18px}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.sum-card{background:#13151f;border:1px solid #1e2235;border-radius:10px;padding:14px}
.sum-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569;margin-bottom:6px}
.sum-val{font-size:22px;font-weight:700;letter-spacing:-.02em}
.income{color:#34d399}.expense{color:#f87171}.balance{color:#60a5fa}
.add-form{background:#13151f;border:1px solid #1e2235;border-radius:10px;padding:14px;margin-bottom:18px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.field{display:flex;flex-direction:column;gap:4px}
label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#475569}
input,select{background:#0b0d14;border:1px solid #1e2235;border-radius:6px;padding:8px 10px;color:#e2e8f0;font-size:13px;outline:none;font-family:inherit}
input:focus,select:focus{border-color:#3b4fd8}
.add-btn{padding:8px 16px;background:#3b4fd8;border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.add-btn:hover{background:#4f62e8}
.tx-panel{background:#13151f;border:1px solid #1e2235;border-radius:10px;overflow:hidden;margin-bottom:12px}
.tx-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #1e2235}
.tx-header h2{font-size:13px;font-weight:600;color:#94a3b8}
.filter-row{display:flex;gap:6px}
.filter-btn{padding:4px 10px;border-radius:99px;border:1px solid #2d3148;background:transparent;color:#94a3b8;cursor:pointer;font-size:11px;font-weight:600}
.filter-btn.active{background:#1e2235;color:#e2e8f0}
.tx-list{max-height:320px;overflow-y:auto}
.tx-item{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #0f1117;transition:background .1s}
.tx-item:hover{background:#1a1d27}
.tx-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.tx-info{flex:1;min-width:0}
.tx-name{font-size:13px;font-weight:500;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tx-date{font-size:11px;color:#475569}
.tx-amt{font-size:14px;font-weight:600;white-space:nowrap}
.tx-del{background:transparent;border:none;color:#334155;cursor:pointer;font-size:16px;padding:4px 6px;border-radius:4px}
.tx-del:hover{color:#f87171;background:#2d0a0a}
.empty{padding:32px;text-align:center;color:#334155;font-size:13px}
.bars-panel{background:#13151f;border:1px solid #1e2235;border-radius:10px;padding:14px}
.bars-panel h3{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-cat{font-size:11px;color:#94a3b8;width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-track{flex:1;height:6px;background:#1e2235;border-radius:99px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px;transition:width .3s}
.bar-amt{font-size:11px;color:#475569;width:60px;text-align:right}
</style>
</head>
<body>
<h1>Budget Tracker</h1>
<div class="summary">
  <div class="sum-card"><div class="sum-label">Income</div><div class="sum-val income" id="sum-i">$0</div></div>
  <div class="sum-card"><div class="sum-label">Expenses</div><div class="sum-val expense" id="sum-e">$0</div></div>
  <div class="sum-card"><div class="sum-label">Balance</div><div class="sum-val balance" id="sum-b">$0</div></div>
</div>
<div class="add-form">
  <div class="field"><label>Description</label><input id="tx-n" placeholder="e.g. Grocery run" style="width:160px"></div>
  <div class="field"><label>Amount ($)</label><input id="tx-a" type="number" placeholder="0.00" step="0.01" style="width:100px"></div>
  <div class="field"><label>Type</label><select id="tx-t"><option value="expense">Expense</option><option value="income">Income</option></select></div>
  <div class="field"><label>Category</label>
    <select id="tx-c">
      <option>Food</option><option>Housing</option><option>Transport</option><option>Health</option>
      <option>Entertainment</option><option>Shopping</option><option>Utilities</option><option>Salary</option><option>Other</option>
    </select>
  </div>
  <div class="field"><label>Date</label><input id="tx-d" type="date"></div>
  <button class="add-btn" onclick="addTx()">Add</button>
</div>
<div class="tx-panel">
  <div class="tx-header"><h2>Transactions</h2>
    <div class="filter-row">
      <button class="filter-btn active" onclick="setF('all',this)">All</button>
      <button class="filter-btn" onclick="setF('income',this)">Income</button>
      <button class="filter-btn" onclick="setF('expense',this)">Expense</button>
    </div>
  </div>
  <div class="tx-list" id="tx-list"></div>
</div>
<div class="bars-panel"><h3>Spending by Category</h3><div id="bars"></div></div>
<script>
const EMOJI={Food:'🍔',Housing:'🏠',Transport:'🚗',Health:'💊',Entertainment:'🎬',Shopping:'🛍️',Utilities:'⚡',Salary:'💰',Other:'📦'};
const COLOR={Food:'var(--status-warning)',Housing:'var(--status-info)',Transport:'#a78bfa',Health:'var(--status-success)',Entertainment:'var(--status-error)',Shopping:'#fb923c',Utilities:'#38bdf8',Salary:'var(--status-success)',Other:'#94a3b8'};
let txs=JSON.parse(localStorage.getItem('budget')||'null')||[
  {id:1,name:'Monthly Salary',amount:5000,type:'income',cat:'Salary',date:'2024-03-01'},
  {id:2,name:'Rent',amount:1500,type:'expense',cat:'Housing',date:'2024-03-02'},
  {id:3,name:'Groceries',amount:180,type:'expense',cat:'Food',date:'2024-03-05'},
  {id:4,name:'Netflix',amount:15,type:'expense',cat:'Entertainment',date:'2024-03-06'},
  {id:5,name:'Gas',amount:60,type:'expense',cat:'Transport',date:'2024-03-08'},
  {id:6,name:'Freelance Project',amount:800,type:'income',cat:'Other',date:'2024-03-10'},
  {id:7,name:'Electric Bill',amount:95,type:'expense',cat:'Utilities',date:'2024-03-12'},
  {id:8,name:'Dinner out',amount:72,type:'expense',cat:'Food',date:'2024-03-14'},
];
let filter='all';
document.getElementById('tx-d').value=new Date().toISOString().slice(0,10);

function save(){localStorage.setItem('budget',JSON.stringify(txs));}

function addTx(){
  const n=document.getElementById('tx-n').value.trim();
  const a=parseFloat(document.getElementById('tx-a').value);
  if(!n||!a||a<=0)return;
  txs.unshift({id:Date.now(),name:n,amount:a,type:document.getElementById('tx-t').value,cat:document.getElementById('tx-c').value,date:document.getElementById('tx-d').value});
  document.getElementById('tx-n').value='';document.getElementById('tx-a').value='';
  save();render();
}

function setF(f,btn){filter=f;document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');render();}

function render(){
  const visible=filter==='all'?txs:txs.filter(t=>t.type===filter);
  const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const bal=inc-exp;
  const fmt=v=>'$'+v.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('sum-i').textContent=fmt(inc);
  document.getElementById('sum-e').textContent=fmt(exp);
  document.getElementById('sum-b').textContent=(bal<0?'-$':'$')+Math.abs(bal).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('sum-b').className='sum-val '+(bal>=0?'balance':'expense');
  document.getElementById('tx-list').innerHTML=visible.length?visible.map(t=>
    '<div class="tx-item"><div class="tx-icon" style="background:'+(COLOR[t.cat]||'#94a3b8')+'22">'+(EMOJI[t.cat]||'📦')+'</div>'
    +'<div class="tx-info"><div class="tx-name">'+t.name+'</div><div class="tx-date">'+t.cat+' · '+t.date+'</div></div>'
    +'<div class="tx-amt '+(t.type==='income'?'income':'expense')+'">'+(t.type==='income'?'+':'-')+'$'+t.amount.toFixed(2)+'</div>'
    +'<button class="tx-del" onclick="txs=txs.filter(x=>x.id!=='+t.id+');save();render()">×</button></div>'
  ).join(''):'<div class="empty">No transactions</div>';
  const cats={};
  txs.filter(t=>t.type==='expense').forEach(t=>{cats[t.cat]=(cats[t.cat]||0)+t.amount;});
  const maxA=Math.max(...Object.values(cats),1);
  document.getElementById('bars').innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>
    '<div class="bar-row"><span class="bar-cat">'+(EMOJI[cat]||'📦')+' '+cat+'</span>'
    +'<div class="bar-track"><div class="bar-fill" style="width:'+(amt/maxA*100).toFixed(1)+'%;background:'+(COLOR[cat]||'#94a3b8')+'"></div></div>'
    +'<span class="bar-amt">$'+amt.toFixed(0)+'</span></div>'
  ).join('');
}

render();
<\/script>
</body>
</html>`;

// ============================================================================
// Mermaid Diagrams
// ============================================================================

const ER_DIAGRAM = `erDiagram
  USER {
    int id PK
    string email UK
    string name
    string role
    datetime created_at
  }
  ORGANIZATION {
    int id PK
    string name
    string plan
    datetime created_at
  }
  PROJECT {
    int id PK
    int org_id FK
    string title
    string status
    datetime deadline
  }
  TASK {
    int id PK
    int project_id FK
    int assignee_id FK
    string title
    string priority
    string status
    datetime due_date
  }
  COMMENT {
    int id PK
    int task_id FK
    int user_id FK
    text body
    datetime created_at
  }
  MEMBERSHIP {
    int user_id FK
    int org_id FK
    string role
  }

  USER ||--o{ MEMBERSHIP : "belongs to"
  ORGANIZATION ||--o{ MEMBERSHIP : "has"
  ORGANIZATION ||--o{ PROJECT : "owns"
  PROJECT ||--o{ TASK : "contains"
  USER ||--o{ TASK : "assigned to"
  TASK ||--o{ COMMENT : "has"
  USER ||--o{ COMMENT : "writes"`;

const ORG_CHART = `flowchart TD
  CEO["CEO\\nSarah Chen"]
  CTO["CTO\\nMike Torres"]
  CPO["CPO\\nLisa Park"]
  CFO["CFO\\nJames Wu"]
  ENG1["Engineering Lead\\nAlex Kumar"]
  ENG2["Engineering Lead\\nPriya Nair"]
  PM1["Product Manager\\nTom Hall"]
  PM2["Product Manager\\nAnna Lee"]
  FIN1["Finance Manager\\nRob Evans"]
  DEV1["Senior Dev\\nChris Tan"]
  DEV2["Senior Dev\\nMaya Patel"]
  DEV3["Engineer\\nJade Kim"]
  DEV4["Engineer\\nOmar Davis"]
  DES1["Designer\\nSophia Reyes"]
  DES2["Designer\\nEthan Brooks"]
  ANA1["Analyst\\nNina Scott"]

  CEO --> CTO
  CEO --> CPO
  CEO --> CFO
  CTO --> ENG1
  CTO --> ENG2
  CPO --> PM1
  CPO --> PM2
  CFO --> FIN1
  ENG1 --> DEV1
  ENG1 --> DEV2
  ENG2 --> DEV3
  ENG2 --> DEV4
  PM1 --> DES1
  PM2 --> DES2
  CFO --> ANA1

  style CEO fill:#3b4fd8,color:#fff,stroke:#3b4fd8
  style CTO fill:#0f766e,color:#fff,stroke:#0f766e
  style CPO fill:#7c3aed,color:#fff,stroke:#7c3aed
  style CFO fill:#b45309,color:#fff,stroke:#b45309`;

const USER_JOURNEY = `journey
  title User Onboarding Journey
  section Discovery
    See ad or referral: 3: User
    Visit landing page: 4: User
    Read features: 3: User
  section Sign Up
    Click Get Started: 5: User
    Fill registration form: 3: User
    Verify email: 2: User, System
    Account created: 5: User, System
  section Onboarding
    Complete profile wizard: 3: User
    Watch intro video: 4: User
    Explore dashboard: 4: User
    Invite teammates: 3: User
  section First Value
    Create first project: 4: User
    Add tasks: 5: User
    Share with team: 5: User, Team
    Complete first task: 5: User`;

const CLASS_DIAGRAM = `classDiagram
  class User {
    +int id
    +string email
    +string name
    +Role role
    +DateTime createdAt
    +login(password) bool
    +updateProfile(data) void
    +getProjects() Project[]
  }

  class Project {
    +int id
    +string title
    +string description
    +Status status
    +DateTime deadline
    +addTask(task) void
    +removeTask(id) void
    +getProgress() float
  }

  class Task {
    +int id
    +string title
    +Priority priority
    +Status status
    +DateTime dueDate
    +User assignee
    +assign(user) void
    +complete() void
    +addComment(text) Comment
  }

  class Comment {
    +int id
    +string body
    +User author
    +DateTime createdAt
    +edit(body) void
    +delete() void
  }

  class Role {
    <<enumeration>>
    ADMIN
    EDITOR
    VIEWER
  }

  class Status {
    <<enumeration>>
    TODO
    IN_PROGRESS
    DONE
    CANCELLED
  }

  class Priority {
    <<enumeration>>
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  User "1" --> "*" Project : owns
  Project "1" --> "*" Task : contains
  Task "*" --> "1" User : assignedTo
  Task "1" --> "*" Comment : has
  Comment "*" --> "1" User : writtenBy
  User --> Role : has
  Task --> Priority : has
  Task --> Status : has
  Project --> Status : has`;

// ============================================================================
// Template registry
// ============================================================================

export const ARTIFACT_TEMPLATES: ArtifactTemplate[] = [
  {
    id: 'kanban-board',
    title: 'Kanban Board',
    description: 'Three-column board with card creation, move actions, and localStorage persistence.',
    kind: 'html',
    category: 'productivity',
    tags: ['kanban', 'board', 'tasks', 'project', 'management', 'workflow', 'todo', 'cards', 'columns'],
    prompt: 'Build a kanban board with Todo, In Progress, and Done columns. Cards can move between columns and new cards can be added via Enter key. Persist to localStorage.',
    content: KANBAN_BOARD,
  },
  {
    id: 'regex-tester',
    title: 'Regex Tester',
    description: 'Live regex matching with flag toggles, highlighted matches, and capture group display.',
    kind: 'html',
    category: 'tool',
    tags: ['regex', 'regexp', 'pattern', 'matching', 'tester', 'flags', 'developer', 'string', 'highlight'],
    prompt: 'Build a regex tester with live pattern matching, flag toggles (g/i/m/s), highlighted matches in the test string, and match details showing position and capture groups.',
    content: REGEX_TESTER,
  },
  {
    id: 'markdown-editor',
    title: 'Markdown Editor',
    description: 'Split-pane editor with live preview, formatting toolbar, and word count. No dependencies.',
    kind: 'html',
    category: 'tool',
    tags: ['markdown', 'editor', 'preview', 'writing', 'split', 'text', 'notes', 'wysiwyg', 'formatting'],
    prompt: 'Build a split-pane markdown editor with live preview on the right. Include a toolbar with bold, italic, code, heading, list, and quote buttons. Show word and character count.',
    content: MARKDOWN_EDITOR,
  },
  {
    id: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Paste JSON to get syntax-highlighted, collapsible tree output with error validation.',
    kind: 'html',
    category: 'tool',
    tags: ['json', 'formatter', 'viewer', 'parser', 'syntax', 'highlight', 'developer', 'tree', 'collapsible', 'validate'],
    prompt: 'Build a JSON formatter. Paste raw JSON on the left to get a syntax-highlighted, collapsible tree on the right. Show validation errors and support minify and copy actions.',
    content: JSON_FORMATTER,
  },
  {
    id: 'kpi-dashboard',
    title: 'KPI Dashboard',
    description: 'Editable metric cards with trend badges and sparkline charts drawn on Canvas.',
    kind: 'html',
    category: 'chart',
    tags: ['kpi', 'dashboard', 'metrics', 'analytics', 'sparkline', 'chart', 'trend', 'business', 'stats', 'revenue'],
    prompt: 'Build a KPI dashboard with metric cards showing revenue, active users, session duration, and churn rate. Each card has a trend badge and sparkline chart. Cards are editable by clicking.',
    content: KPI_DASHBOARD,
  },
  {
    id: 'invoice-generator',
    title: 'Invoice Generator',
    description: 'Fill in details and line items, preview a formatted invoice, and print as PDF.',
    kind: 'html',
    category: 'tool',
    tags: ['invoice', 'billing', 'generator', 'receipt', 'payment', 'business', 'print', 'pdf', 'line items'],
    prompt: 'Build an invoice generator with fields for sender/client info, line items with qty and rate, tax calculation, and a live formatted invoice preview. Include a print button.',
    content: INVOICE_GENERATOR,
  },
  {
    id: 'data-table',
    title: 'Data Table',
    description: 'Sortable, searchable, paginated table with role/status badges and column filters.',
    kind: 'html',
    category: 'tool',
    tags: ['table', 'data', 'sort', 'search', 'filter', 'pagination', 'grid', 'list', 'users', 'sortable'],
    prompt: 'Build a data table with search, column sorting, status and role filters, and pagination. Use sample user data with name, email, role, status, join date, and score.',
    content: DATA_TABLE,
  },
  {
    id: 'budget-tracker',
    title: 'Budget Tracker',
    description: 'Track income and expenses with category breakdown bar chart and localStorage.',
    kind: 'html',
    category: 'productivity',
    tags: ['budget', 'expense', 'finance', 'tracker', 'spending', 'income', 'money', 'personal', 'categories'],
    prompt: 'Build a budget tracker. Users can add income/expense transactions with a category. Show total income, expenses, and balance, a scrollable transaction list, and a category spending bar chart.',
    content: BUDGET_TRACKER,
  },
  {
    id: 'er-diagram',
    title: 'ER Diagram',
    description: 'Entity-relationship diagram for a SaaS app with users, orgs, projects, tasks, and comments.',
    kind: 'mermaid',
    category: 'diagram',
    tags: ['er', 'entity', 'relationship', 'database', 'schema', 'sql', 'tables', 'diagram', 'data model'],
    prompt: 'Create an ER diagram for a project management SaaS app with users, organizations, projects, tasks, comments, and memberships including all foreign key relationships.',
    content: ER_DIAGRAM,
  },
  {
    id: 'org-chart',
    title: 'Org Chart',
    description: 'Company hierarchy chart from C-suite down to individual contributors.',
    kind: 'mermaid',
    category: 'diagram',
    tags: ['org', 'organization', 'chart', 'hierarchy', 'company', 'team', 'structure', 'management', 'reporting'],
    prompt: 'Create an org chart for a tech company with CEO, CTO, CPO, CFO, engineering leads, product managers, designers, developers, and analysts.',
    content: ORG_CHART,
  },
  {
    id: 'user-journey',
    title: 'User Journey Map',
    description: "Journey diagram mapping a user's onboarding flow from discovery to first value.",
    kind: 'mermaid',
    category: 'diagram',
    tags: ['user', 'journey', 'map', 'onboarding', 'flow', 'ux', 'experience', 'funnel', 'steps'],
    prompt: 'Create a user journey map for SaaS onboarding covering discovery, sign up, onboarding wizard, and reaching first value.',
    content: USER_JOURNEY,
  },
  {
    id: 'class-diagram',
    title: 'Class Diagram',
    description: 'UML class diagram with User, Project, Task, Comment, and enumerations.',
    kind: 'mermaid',
    category: 'diagram',
    tags: ['class', 'diagram', 'oop', 'object', 'uml', 'inheritance', 'schema', 'design', 'types'],
    prompt: 'Create a UML class diagram for a project management app with User, Project, Task, Comment classes, Role/Status/Priority enumerations, and their associations.',
    content: CLASS_DIAGRAM,
  },
];

// ============================================================================
// Lookup helpers
// ============================================================================

export const TEMPLATES_BY_ID = Object.fromEntries(
  ARTIFACT_TEMPLATES.map(t => [t.id, t]),
);

export const TEMPLATES_BY_CATEGORY = ARTIFACT_TEMPLATES.reduce<
  Record<string, ArtifactTemplate[]>
>((acc, t) => {
  (acc[t.category] ??= []).push(t);
  return acc;
}, {});

export const TEMPLATE_CATEGORIES = [
  ...new Set(ARTIFACT_TEMPLATES.map(t => t.category)),
] as ArtifactCategory[];
