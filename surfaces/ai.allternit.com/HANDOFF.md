# Allternit Design — Agent Handoff Document
**Session cutoff:** 2026-05-09  
**Working directory:** `/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com`  
**Author:** Claude Sonnet 4.6 (session ending)

---

## Context

This document is a complete handoff for the Allternit Design mode. The following tasks are DONE and must not be re-done:

- ✅ #19 Rename "Allternit Studio" → "Allternit Design" (4 files)
- ✅ #20 Fix onboarding gate — shows wizard once, then `NewProjectScreen` on subsequent opens
- ✅ #21 Port DesignDirection system from nexu-io/open-design (`src/lib/design/directions.ts` — 18 directions with OKLch palettes)
- ✅ #22 Replace flat SchoolsGallery with `NewProjectScreen` (`src/views/design/NewProjectScreen.tsx`)
- ✅ #23 Fetch and parse 148 DESIGN.md files → `src/lib/design/design-systems-library.ts`
- ✅ #24 Wire `DesignRegistryView` to real library (replaced `DESIGN_MARKETPLACE` in `design-registry.ts` with a `.map()` over `DESIGN_SYSTEMS_LIBRARY`)
- ✅ #25 Wire Install button to inject DESIGN.md into active session (`handleInstallDesign` in `DesignModeView.tsx`, passes `onInstall` to `DesignRegistryView`)
- ✅ #26 Question-form discovery pattern (already existed: `question-form-parser.ts`, `QuestionFormView.tsx`, `StudioMessageRenderer.tsx`)
- ✅ #27 Anti-slop rules + craft docs merged into `studio-system-prompt.ts` (16-item anti-slop, Typography discipline, Accessibility baseline, Spacing discipline, Motion discipline)
- ✅ #30 SketchEditor: `DesignTldrawCanvas.tsx` (632 lines, full tldraw integration)
- ✅ #31 `ArtifactPreviewPane.tsx` — sandboxed iframe preview with viewport switcher (Desktop/Tablet/Mobile), zoom controls, ResizeObserver fit-to-container

---

## Remaining Tasks (PENDING — do ALL of these)

### Task #28 — Port EDITMODE Live Token Tweak System

**What it is:** When the agent generates an HTML artifact, it can embed a special JSON config block that defines editable CSS tokens. A panel in the preview UI reads this block and lets users tweak values live, posting them to the iframe via `postMessage`.

**Status:** Parser created. Remaining: UI panel + system prompt instruction.

#### Step 1 — The parser is already done
File: `src/lib/design/editmode-parser.ts`  
It exports:
- `parseEditModeConfig(html: string): EditModeConfig | null`
- `EditModeToken` type (id, label, type: `'color'|'range'|'select'|'text'`, value, min, max, options)
- `EditModeConfig` type ({ tokens: EditModeToken[] })

The marker format it looks for in HTML:
```
/*EDITMODE-BEGIN*/
{ "tokens": [...] }
/*EDITMODE-END*/
```

#### Step 2 — Modify `src/components/design/ArtifactPreviewPane.tsx`

This file is ~178 lines. It has: toolbar, canvas area with iframe, status bar.

Add these imports at the top:
```tsx
import { parseEditModeConfig, type EditModeToken, type EditModeConfig } from "../../lib/design/editmode-parser";
import { Sliders } from "@phosphor-icons/react";
```

Add state inside the component:
```tsx
const iframeRef = useRef<HTMLIFrameElement>(null);
const [editConfig, setEditConfig] = useState<EditModeConfig | null>(null);
const [editTokens, setEditTokens] = useState<EditModeToken[]>([]);
const [showEditPanel, setShowEditPanel] = useState(false);
```

Parse the config when `html` prop changes (add a useEffect):
```tsx
useEffect(() => {
  const config = parseEditModeConfig(html);
  setEditConfig(config);
  setEditTokens(config?.tokens ?? []);
  setShowEditPanel(false);
}, [html]);
```

Add a function to update a token and postMessage to iframe:
```tsx
function updateToken(id: string, value: string | number) {
  const updated = editTokens.map(t => t.id === id ? { ...t, value } : t);
  setEditTokens(updated);
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'EDITMODE_UPDATE', tokens: Object.fromEntries(updated.map(t => [`--${t.id}`, String(t.value)])) },
    '*'
  );
}
```

In the toolbar, after the existing divider that comes after the Export button, add a Tweaks toggle button (only shown when `editConfig` is non-null):
```tsx
{editConfig && editConfig.tokens.length > 0 && (
  <>
    <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
    <button
      onClick={() => setShowEditPanel(p => !p)}
      style={{ ...iconBtn, color: showEditPanel ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
      title="Live token tweaks"
    >
      <Sliders size={13} />
    </button>
  </>
)}
```

Add `ref={iframeRef}` to the `<iframe>` element.

Add the EditPanel below the canvas area (before the status bar):
```tsx
{showEditPanel && editConfig && (
  <div style={{
    padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
    background: 'var(--surface-panel)', display: 'flex', flexDirection: 'column', gap: 10,
    maxHeight: 220, overflowY: 'auto', flexShrink: 0,
  }}>
    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Live Tweaks
    </span>
    {editTokens.map(token => (
      <div key={token.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 120 }}>
          {token.label}
        </span>
        {token.type === 'color' && (
          <input
            type="color"
            value={String(token.value)}
            onChange={e => updateToken(token.id, e.target.value)}
            style={{ width: 32, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer' }}
          />
        )}
        {token.type === 'range' && (
          <input
            type="range"
            min={token.min ?? 0}
            max={token.max ?? 100}
            step={token.step ?? 1}
            value={Number(token.value)}
            onChange={e => updateToken(token.id, parseInt(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
          />
        )}
        {token.type === 'select' && (
          <select
            value={String(token.value)}
            onChange={e => updateToken(token.id, e.target.value)}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', padding: '3px 6px' }}
          >
            {(token.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
        {token.type === 'text' && (
          <input
            type="text"
            value={String(token.value)}
            onChange={e => updateToken(token.id, e.target.value)}
            style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', padding: '4px 8px', outline: 'none' }}
          />
        )}
        {token.type === 'range' && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 28, textAlign: 'right' }}>
            {token.value}
          </span>
        )}
      </div>
    ))}
  </div>
)}
```

#### Step 3 — Add EDITMODE instruction to `src/lib/design/studio-system-prompt.ts`

In `BASE_DESIGNER_IDENTITY` constant (around line 25), at the end of the "## Slides + prototypes" section, add:

```
## Live token panel (EDITMODE)
For interactive prototypes where live tweaking would add value, embed an EDITMODE config block in the HTML. Place this immediately after `<!doctype html>` inside a script comment:

\`\`\`html
<!--
/*EDITMODE-BEGIN*/
{
  "tokens": [
    { "id": "color-primary", "label": "Primary color", "type": "color", "value": "#3b82f6" },
    { "id": "radius-base", "label": "Corner radius", "type": "range", "value": 12, "min": 0, "max": 48, "step": 2 },
    { "id": "font-family", "label": "Font", "type": "select", "value": "Inter", "options": ["Inter", "Geist", "Space Grotesk", "Playfair Display"] }
  ]
}
/*EDITMODE-END*/
-->
<script>
window.addEventListener('message', (e) => {
  if (e.data?.type !== 'EDITMODE_UPDATE') return;
  Object.entries(e.data.tokens).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
});
</script>
\`\`\`

Then bind your design tokens to CSS custom properties: `--color-primary`, `--radius-base`, etc. EDITMODE tokens are optional — only add them for prototypes, not for slide decks or static designs.
```

Add this to `BASE_DESIGNER_IDENTITY` inside the string constant, after the "Slides + prototypes" section.

---

### Task #29 — Port Token Extraction Pipeline (CSS vars, Tailwind, DTCG)

**What it is:** From OpenCoworkAI/open-codesign, a token extraction pipeline that can parse CSS custom properties, Tailwind config, and DTCG token JSON from an existing codebase or pasted code, then expose those tokens as editable EDITMODE tokens.

**Create:** `src/lib/design/token-extractor.ts`

```typescript
/**
 * Token extraction pipeline — CSS vars, Tailwind config, DTCG
 * Ported from OpenCoworkAI/open-codesign
 */

export interface ExtractedToken {
  id: string;       // CSS var name without --
  label: string;    // human-readable label
  value: string;
  source: 'css-var' | 'tailwind' | 'dtcg';
  type: 'color' | 'dimension' | 'fontFamily' | 'string';
}

// Extract CSS custom properties from a :root block or any CSS text
export function extractCssVars(css: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const id = m[1];
    const rawValue = m[2].trim();
    const type = inferTokenType(rawValue);
    tokens.push({
      id,
      label: idToLabel(id),
      value: rawValue,
      source: 'css-var',
      type,
    });
  }
  return tokens;
}

// Extract colors from a Tailwind theme config (JSON or JS object literal)
export function extractTailwindTokens(tailwindConfig: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  // Find colors block: "colors": { ... }
  const colorsMatch = tailwindConfig.match(/"?colors"?\s*:\s*\{([\s\S]*?)\}/);
  if (!colorsMatch) return tokens;
  const colorsBlock = colorsMatch[1];
  const re = /"?([\w-]+)"?\s*:\s*["']?(#[0-9a-fA-F]{3,8}|oklch[^"',]+|rgb[^"',]+)["']?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(colorsBlock)) !== null) {
    tokens.push({
      id: `tw-${m[1]}`,
      label: `Color: ${m[1]}`,
      value: m[2].trim(),
      source: 'tailwind',
      type: 'color',
    });
  }
  return tokens;
}

// Extract from DTCG token JSON format: { "token-name": { "$value": "...", "$type": "..." } }
export function extractDtcgTokens(json: string): ExtractedToken[] {
  const tokens: ExtractedToken[] = [];
  try {
    const parsed = JSON.parse(json);
    extractDtcgNode(parsed, '', tokens);
  } catch {
    // malformed JSON — return empty
  }
  return tokens;
}

function extractDtcgNode(node: any, prefix: string, out: ExtractedToken[]) {
  if (typeof node !== 'object' || node === null) return;
  if ('$value' in node) {
    const id = prefix.replace(/^\./, '').replace(/\./g, '-');
    out.push({
      id,
      label: idToLabel(id),
      value: String(node.$value),
      source: 'dtcg',
      type: mapDtcgType(node.$type),
    });
  } else {
    for (const key of Object.keys(node)) {
      if (!key.startsWith('$')) {
        extractDtcgNode(node[key], `${prefix}.${key}`, out);
      }
    }
  }
}

function mapDtcgType(t: string | undefined): ExtractedToken['type'] {
  if (t === 'color') return 'color';
  if (t === 'dimension' || t === 'spacing' || t === 'borderRadius') return 'dimension';
  if (t === 'fontFamily') return 'fontFamily';
  return 'string';
}

function inferTokenType(value: string): ExtractedToken['type'] {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value) || /^oklch/.test(value) || /^rgb/.test(value) || /^hsl/.test(value)) return 'color';
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return 'dimension';
  if (/^["']?[\w\s,]+["']?$/.test(value) && value.includes(',')) return 'fontFamily';
  return 'string';
}

function idToLabel(id: string): string {
  return id
    .replace(/^(color|bg|text|border|radius|spacing|font)-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

**Wire into DesignImportModal:** The import modal at `src/views/design/DesignImportModal.tsx` should have a "Extract Tokens" tab that accepts pasted CSS/Tailwind/DTCG input and calls the extractor to populate an `EditModeConfig` that can be applied to the active session.

Read `DesignImportModal.tsx` first to understand its current structure, then add:
1. A new tab "Extract Tokens" alongside the existing tabs
2. A textarea for pasting code
3. Dropdown: source type (CSS vars / Tailwind / DTCG)
4. "Extract" button → call the appropriate function → display result as badge list
5. "Apply to project" button → `sendMessageStream(sessionId, { text: '[Token Import] Apply these design tokens: ' + JSON.stringify(tokens) })`

---

### Task #32 — Design and Build Live Artifacts System

**What it is:** Live Artifacts are HTML designs that have a template (with `{{ variable }}` placeholders) and a data source (JSON). They auto-refresh when data updates. This powers Orbit-style briefings and repeatable report templates.

#### Step 1 — Create `src/lib/design/live-artifact.ts`

```typescript
export interface LiveArtifact {
  id: string;
  name: string;
  templateHtml: string;    // HTML with {{ path.to.key }} placeholders
  dataJson: string;        // Current data as JSON string
  refreshIntervalMs?: number;  // 0 = manual only
  lastRefreshedAt?: string;
  createdAt: string;
}

// Interpolate {{ variable }} placeholders from data object
export function renderLiveArtifact(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const keys = path.split('.');
    let val: any = data;
    for (const k of keys) { val = val?.[k]; }
    return val !== undefined ? String(val) : '';
  });
}

export function parseLiveArtifactData(jsonStr: string): Record<string, any> {
  try { return JSON.parse(jsonStr); } catch { return {}; }
}
```

#### Step 2 — Create `src/views/design/LiveArtifactEditor.tsx`

A full-page split editor: left panel = template HTML editor (a `<textarea>`), right panel = `ArtifactPreviewPane` with the rendered output. Bottom bar has a JSON data editor.

Structure:
- State: `template: string`, `dataJson: string`, `renderedHtml: string`
- `useEffect` on `template` + `dataJson` → call `renderLiveArtifact()` → set `renderedHtml`
- Left pane: labeled "Template" with a `<textarea>` showing HTML with `{{ }}` placeholders
- Right pane: `<ArtifactPreviewPane html={renderedHtml} title="Live Preview" identifier="live-preview" />`
- Bottom panel: JSON data editor textarea, labeled "Data"
- Save button: saves to localStorage as `LiveArtifact`
- Add tab `live` to `DesignModeView` canvas tabs

#### Step 3 — Add `live` tab to `DesignModeView.tsx`

In `startProject`, add to tabs array:
```tsx
{ id: 'live', label: 'Live Artifacts', type: 'live' as CanvasTab }
```

Add `'live'` to the `CanvasTab` type union in `DesignModeView.tsx` (line ~36):
```tsx
type CanvasTab = 'system' | 'files' | 'questions' | 'sketch' | 'mobile' | 'video' | 'docs' | 'handoff' | 'graph' | 'pipeline' | 'team' | 'market' | 'brand' | 'live';
```

Add the tab render (in the tab content section, add alongside other tabs):
```tsx
{activeTab === 'live' && (
  <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
    <LiveArtifactEditor />
  </div>
)}
```

Add `'live'` to the full-bleed tab exclusion list (line ~422):
```tsx
{!['sketch', 'system', 'handoff', 'mobile', 'video', 'docs', 'market', 'brand', 'graph', 'pipeline', 'live'].includes(activeTab) && (
```

Add import at top of `DesignModeView.tsx`:
```tsx
import { LiveArtifactEditor } from "./LiveArtifactEditor";
```

---

### Task #33 — Integrate Composio SDK for Work Tool Connectors

**What it is:** Composio provides OAuth connectors for 100+ tools (GitHub, Linear, Notion, Gmail, Slack). The design setup flow should prompt on first use to connect these tools. Confirmed approach: backend = Allternit API server; Composio = prompt on first use.

**Important:** Do NOT hard-code any API keys. Read the existing `.env.local` or environment variable patterns used in the surface.

#### Step 1 — Read existing pattern
Read `src/app/api/oauth/token/route.ts` (or nearby OAuth routes) to understand how the surface currently handles tokens. Then model the Composio integration on the same pattern.

#### Step 2 — Create `src/lib/design/composio-connector.ts`

This is a client-side module that calls the Allternit API backend (not Composio directly — the backend proxies Composio):

```typescript
export type ComposioApp = 'github' | 'linear' | 'notion' | 'gmail' | 'slack';

export interface ComposioConnection {
  app: ComposioApp;
  connected: boolean;
  accountId?: string;
}

export async function getComposioConnections(): Promise<ComposioConnection[]> {
  const res = await fetch('/api/design/composio/connections');
  if (!res.ok) return [];
  return res.json();
}

export async function initiateComposioConnect(app: ComposioApp): Promise<{ authUrl: string }> {
  const res = await fetch('/api/design/composio/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app }),
  });
  return res.json();
}
```

#### Step 3 — Create `src/app/api/design/composio/connections/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: proxy to Composio API using COMPOSIO_API_KEY from process.env
  // For now return empty — Orbit wires this up when ready
  return NextResponse.json([]);
}
```

#### Step 4 — Create `src/app/api/design/composio/connect/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { app } = await req.json();
  // TODO: call Composio SDK to get OAuth URL
  // const { composio } = await import('@composio/core');
  // const authUrl = await composio.getOAuthUrl(app, process.env.COMPOSIO_API_KEY);
  return NextResponse.json({ authUrl: `/api/design/composio/oauth-callback?app=${app}` });
}
```

#### Step 5 — Create `src/views/design/ComposioSetupModal.tsx`

A modal shown on first use of Orbit or Live Artifacts that lists the 5 integration targets (GitHub, Linear, Notion, Gmail, Slack) with connection status and Connect buttons. Import this in `DesignModeView.tsx` and show it when `showComposioSetup` state is true.

The modal should:
- Fetch connections on mount via `getComposioConnections()`
- Show each app with a green checkmark (connected) or "Connect" button (not connected)
- "Connect" opens a popup window to `authUrl`
- On popup close, re-fetch connections
- "Skip for now" dismisses and sets `localStorage.setItem('composio-setup-skipped', '1')`

---

### Task #34 — Build Orbit Daily Digest — Autonomous Scheduled Design Briefings

**What it is:** Orbit is an autonomous scheduled agent that pulls from connected work tools (GitHub, Linear, Notion, Gmail) and generates a daily design briefing as a Live Artifact HTML document.

#### Step 1 — Create `src/lib/design/orbit-engine.ts`

```typescript
export interface OrbitDigestConfig {
  projectName: string;
  sources: ('github' | 'linear' | 'notion' | 'gmail')[];
  scheduleCron?: string;  // e.g. "0 9 * * 1-5" for 9am weekdays
}

export interface OrbitDigestResult {
  generatedAt: string;
  html: string;         // complete standalone HTML artifact
  summary: string;      // 2-3 sentence text summary
  sources: string[];    // what was pulled
}

export async function generateOrbitDigest(
  config: OrbitDigestConfig,
  sessionSendMessage: (text: string) => Promise<void>,
): Promise<void> {
  const prompt = buildOrbitPrompt(config);
  await sessionSendMessage(prompt);
}

function buildOrbitPrompt(config: OrbitDigestConfig): string {
  return `[ORBIT DIGEST REQUEST]
Generate a daily design briefing for project: "${config.projectName}".
Sources to synthesize: ${config.sources.join(', ')}.

The briefing should be a complete HTML artifact with:
- A header with today's date and project name
- A "What shipped" section (recent GitHub commits/PRs if connected)
- A "In progress" section (Linear/Notion items)
- A "Design decisions" section (key choices made today)
- A "Focus for today" section with 3 prioritized next actions

Use the active design system's palette. Make it scannable and dense — this is a morning briefing, not a report. Output as a single artifact block.

Include an EDITMODE config block with at least: primary color, accent color, font family.`;
}
```

#### Step 2 — Create `src/views/design/OrbitView.tsx`

A dedicated view (new tab `orbit`) that shows:
- List of past digests stored in localStorage
- "Generate now" button → calls `generateOrbitDigest()` → shows loading state → renders result in `ArtifactPreviewPane`
- Schedule config: toggle to enable daily auto-generation, time picker
- Source connections: links to `ComposioSetupModal` for connecting tools

#### Step 3 — Wire into `DesignModeView.tsx`

Add `'orbit'` to:
- `CanvasTab` type union
- The tabs array in `startProject`
- The tab content render section
- The full-bleed exclusion list

Add import:
```tsx
import { OrbitView } from "./OrbitView";
```

Tab render:
```tsx
{activeTab === 'orbit' && (
  <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
    <OrbitView projectName={activeProject?.name} />
  </div>
)}
```

---

### Task #35 — Port Anti-Slop HTML Linter as Post-Generation Quality Gate

**What it is:** From nexu-io/open-design, an anti-AI-slop linter that runs on generated HTML and flags violations before showing the artifact. The system prompt already lists 16 anti-slop rules. This task makes them machine-enforceable.

#### Step 1 — Create `src/lib/design/html-linter.ts`

```typescript
export interface LintViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  fix?: string;   // suggested auto-fix description
}

export interface LintResult {
  violations: LintViolation[];
  score: number;       // 0-100, 100 = clean
  passed: boolean;     // true if no errors
}

export function lintGeneratedHtml(html: string): LintResult {
  const violations: LintViolation[] = [];

  // Rule 1: No Tailwind indigo
  if (/indigo-\d00|#6366f1|#818cf8/i.test(html)) {
    violations.push({ rule: 'no-tailwind-indigo', severity: 'warning', message: 'Tailwind indigo detected — use design system accent color instead.' });
  }

  // Rule 2: No lorem ipsum
  if (/lorem ipsum/i.test(html)) {
    violations.push({ rule: 'no-lorem', severity: 'error', message: 'Lorem ipsum placeholder text detected — use realistic content.' });
  }

  // Rule 3: No generic placeholder text
  if (/\bplaceholder (text|content|here)\b/i.test(html)) {
    violations.push({ rule: 'no-placeholder-text', severity: 'warning', message: 'Generic placeholder text detected.' });
  }

  // Rule 4: No external CDN placeholder images
  if (/placehold\.co|picsum|dummyimage|placeholder\.com/i.test(html)) {
    violations.push({ rule: 'no-cdn-placeholders', severity: 'error', message: 'External placeholder image CDN detected — use inline SVG or solid colors.' });
  }

  // Rule 5: No scrollIntoView
  if (/scrollIntoView/i.test(html)) {
    violations.push({ rule: 'no-scroll-into-view', severity: 'warning', message: 'scrollIntoView detected — avoid in preview artifacts.' });
  }

  // Rule 6: No ALL-CAPS without letter-spacing
  // Find uppercase text blocks > 5 chars that don't have letter-spacing
  const capsMatches = html.match(/text-transform:\s*uppercase[^}]*(?!letter-spacing)/gi) ?? [];
  if (capsMatches.length > 2) {
    violations.push({ rule: 'caps-letter-spacing', severity: 'warning', message: 'ALL-CAPS text should include letter-spacing (0.05em+) for readability.' });
  }

  // Rule 7: No external Google Fonts without preconnect
  if (/fonts\.googleapis\.com/.test(html) && !html.includes('rel="preconnect"')) {
    violations.push({ rule: 'font-preconnect', severity: 'warning', message: 'Google Fonts loaded without preconnect — add <link rel="preconnect" href="https://fonts.googleapis.com">.' });
  }

  // Rule 8: No missing <title>
  if (/<html/.test(html) && !/<title>/.test(html)) {
    violations.push({ rule: 'html-title', severity: 'warning', message: 'HTML document missing <title>.' });
  }

  // Rule 9: Color not sole differentiator — check for disabled states
  // This is a heuristic: if there are form elements, there should be aria-label or label
  if (/<input|<select|<textarea/.test(html) && !/<label/.test(html)) {
    violations.push({ rule: 'form-labels', severity: 'error', message: 'Form inputs detected without <label> elements — add labels for accessibility.' });
  }

  // Rule 10: No inline event handlers (security)
  if (/\bon\w+\s*=\s*["']/i.test(html)) {
    violations.push({ rule: 'no-inline-handlers', severity: 'warning', message: 'Inline event handlers (onclick=, onload=) detected — use addEventListener instead.' });
  }

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));
  
  return {
    violations,
    score,
    passed: errorCount === 0,
  };
}
```

#### Step 2 — Wire into `StudioMessageRenderer.tsx`

In `StudioMessageRenderer.tsx` (at `src/components/design/StudioMessageRenderer.tsx`), when rendering an `artifact` segment, run the linter and show a quality badge:

```tsx
import { lintGeneratedHtml, type LintResult } from "../../lib/design/html-linter";

// Inside the artifact case of the map:
if (seg.kind === 'artifact') {
  const lintResult = lintGeneratedHtml(seg.artifact.content);
  return (
    <div key={seg.artifact.identifier + i}>
      {lintResult.violations.length > 0 && (
        <LintBadge result={lintResult} />
      )}
      <ArtifactPreviewPane ... />
    </div>
  );
}
```

Create the `LintBadge` component inside `StudioMessageRenderer.tsx`:

```tsx
function LintBadge({ result }: { result: LintResult }) {
  const [expanded, setExpanded] = useState(false);
  const errors = result.violations.filter(v => v.severity === 'error');
  const warnings = result.violations.filter(v => v.severity === 'warning');
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: errors.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
          color: errors.length > 0 ? '#ef4444' : '#ca8a04',
          fontSize: 11, fontWeight: 700,
        }}
      >
        Quality: {result.score}/100
        {errors.length > 0 && ` · ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
        {warnings.length > 0 && ` · ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
      </button>
      {expanded && (
        <div style={{ marginTop: 4, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          {result.violations.map((v, i) => (
            <div key={i} style={{ fontSize: 11, color: v.severity === 'error' ? '#ef4444' : '#ca8a04', lineHeight: 1.5, marginBottom: 4 }}>
              <strong>{v.severity.toUpperCase()}</strong> [{v.rule}]: {v.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Remember to add `useState` import to `StudioMessageRenderer.tsx` if not already present.

---

## File Reference Map

| File | Status | Notes |
|------|--------|-------|
| `src/lib/design/editmode-parser.ts` | ✅ Created | Parser done, needs UI wiring |
| `src/components/design/ArtifactPreviewPane.tsx` | ⚠️ Needs edit | Add EDITMODE panel, iframeRef |
| `src/lib/design/studio-system-prompt.ts` | ⚠️ Needs edit | Add EDITMODE instruction block |
| `src/lib/design/token-extractor.ts` | ❌ Create new | CSS vars / Tailwind / DTCG extractor |
| `src/views/design/DesignImportModal.tsx` | ⚠️ Needs edit | Add "Extract Tokens" tab |
| `src/lib/design/live-artifact.ts` | ❌ Create new | Live artifact engine |
| `src/views/design/LiveArtifactEditor.tsx` | ❌ Create new | Template + data + preview editor |
| `src/views/design/DesignModeView.tsx` | ⚠️ Needs edit | Add `live`, `orbit` tabs + imports |
| `src/lib/design/composio-connector.ts` | ❌ Create new | Composio client module |
| `src/app/api/design/composio/connections/route.ts` | ❌ Create new | GET connections API route |
| `src/app/api/design/composio/connect/route.ts` | ❌ Create new | POST connect API route |
| `src/views/design/ComposioSetupModal.tsx` | ❌ Create new | OAuth setup modal |
| `src/lib/design/orbit-engine.ts` | ❌ Create new | Orbit digest engine |
| `src/views/design/OrbitView.tsx` | ❌ Create new | Orbit UI view |
| `src/lib/design/html-linter.ts` | ❌ Create new | HTML quality linter |
| `src/components/design/StudioMessageRenderer.tsx` | ⚠️ Needs edit | Add LintBadge + linter call |

---

## Execution Order

Complete tasks in this order to avoid broken states:

1. **Task #28** (EDITMODE): Edit `ArtifactPreviewPane.tsx` + add to `studio-system-prompt.ts`
2. **Task #35** (Linter): Create `html-linter.ts` + edit `StudioMessageRenderer.tsx` — standalone, no deps
3. **Task #29** (Token extraction): Create `token-extractor.ts` + edit `DesignImportModal.tsx`
4. **Task #32** (Live Artifacts): Create `live-artifact.ts` + `LiveArtifactEditor.tsx` + wire into `DesignModeView.tsx`
5. **Task #33** (Composio): Create client module + API routes + `ComposioSetupModal.tsx`
6. **Task #34** (Orbit): Create `orbit-engine.ts` + `OrbitView.tsx` + wire into `DesignModeView.tsx`

---

## Key Patterns to Follow

- **No build commands** during task work — never run `tsc`, `npm build`, `cargo build`
- **Read before editing** — always Read a file before using Edit tool
- **CSS variables** for all colors: `var(--bg-primary)`, `var(--text-secondary)`, `var(--accent-primary)`, `var(--border-subtle)`, `var(--surface-panel)`, `var(--surface-hover)`
- **No external API calls from browser** — route through `/api/...` Next.js routes
- **localStorage** for user preferences: key pattern `allternit-design-*`
- **Zustand store** for session management: `useDesignSessionStore` + `useDesignSessionActions` from `src/views/design/DesignSessionStore.ts`
- **sendMessageStream(sessionId, { text })** to inject context into active session
- **No comments** unless the WHY is non-obvious; no docstrings

---

## DesignModeView.tsx Current State Summary

- Line 36: `CanvasTab` type — needs `'live' | 'orbit'` added
- Line 224: component function `DesignModeView`
- Line 248: `installedDesignId` state (just added this session)
- Line 287: `handleInstallDesign` function (just added this session)
- Line 295: `startProject` function — add `live` and `orbit` to tabs array
- Line 353: tab headers loop — no change needed (dynamic from project.tabs)
- Line 401-405: `market` tab render — correct
- Line 422: full-bleed tab exclusion list — add `'live'`, `'orbit'`
- Import at line 24: `DesignRegistryView` — add `LiveArtifactEditor`, `OrbitView`, `ComposioSetupModal`
- Import at line 31: `composeStudioSystemPrompt` — no change needed

---

## Important: `design-registry.ts` Change Already Made

The `DESIGN_MARKETPLACE` export in `src/lib/design/design-registry.ts` is now **computed at module load time** by mapping over `DESIGN_SYSTEMS_LIBRARY` (148 entries from nexu-io/open-design). The old hardcoded array is still in the file but renamed `_LEGACY_MARKETPLACE_UNUSED` and not exported. Do NOT revert this change.

The `TAG_CATEGORIES` in `src/views/design/DesignRegistryView.tsx` (lines 47-57) still references old tag names like `'minimalist'`, `'dark'`, `'clean'` — most of these will return 0 counts now since the library uses `categoryToTags()` which generates different tag names. **Update `TAG_CATEGORIES` in `DesignRegistryView.tsx`** to reflect actual tags from the library: `['ai', 'llm', 'ecommerce', 'retail', 'enterprise', 'b2b', 'consumer', 'media', 'design', 'creative', 'themed', 'unique', 'finance', 'fintech', 'health', 'medical', 'edu', 'learning', 'starter', 'template']`.

Also update `TOP_CREATORS` in `DesignRegistryView.tsx` (lines 59-63) — it currently references `@allternit`, `@vercel`, `@linear`, `@stripe` which are wrong for the new library. Change to: `[{ handle: '@nexu-io', name: 'nexu-io', designs: 148, verified: true }]` or similar.
