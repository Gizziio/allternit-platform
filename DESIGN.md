# DESIGN.md — Allternit Design System

Version: v2.0  
Brand: Allternit PBC / A://TERNIT  
Last Updated: 2026-05-09

---

## Core Principle

Allternit design is not decoration. It is system infrastructure.

Every surface must communicate authority, clarity, structure, and endurance.

---

## 1. Typography

### 1.1 Typeface Families

#### Allternit Sans
Primary platform and interface typeface.

Use for:
- app UI
- navigation
- buttons
- labels
- dashboards
- settings
- system states
- short explanatory text

#### Allternit Serif
Institutional and long-form typeface.

Use for:
- A://Research
- whitepapers
- essays
- reports
- editorial pages
- philosophy/theory writing
- institutional statements

#### Allternit Mono
Execution and protocol typeface.

Use for:
- code
- logs
- traces
- terminal output
- agent execution steps
- JSON/YAML/config snippets
- protocol text

### 1.2 Locked Usage Rules

1. Sans is the default UI font.
2. Serif is only for research, editorial, long-form, and institutional material.
3. Mono is only for code, logs, traces, agent output, and protocol/config text.
4. Never assign fonts directly inside components.
5. Always use design tokens, typography components, or approved utility classes.
6. Never randomly mix serif and sans in the same context.
7. The `A://` prefix must be treated as a brand/protocol glyph and kept visually consistent.
8. No decorative or novelty fonts.
9. No ad-hoc font imports unless approved in this file.
10. Any new text style must be added to the typography token system first.

### 1.3 Surface Mapping

| Surface | Typeface |
|---|---|
| Platform shell | Allternit Sans |
| Dashboard cards | Allternit Sans |
| Buttons | Allternit Sans |
| Navigation | Allternit Sans |
| A://Research article title | Allternit Serif |
| A://Research body | Allternit Serif |
| Whitepapers | Allternit Serif |
| Code blocks | Allternit Mono |
| Agent logs | Allternit Mono |
| Terminal panels | Allternit Mono |

### 1.4 Text Hierarchy

Platform UI:
- `text-display`
- `text-heading`
- `text-subheading`
- `text-body`
- `text-caption`
- `text-label`
- `text-code`

Research:
- `research-display`
- `research-heading`
- `research-body`
- `research-meta`
- `research-note`

Agent / protocol:
- `agent-log`
- `agent-step`
- `agent-status`
- `protocol-token`

### 1.5 CSS Token Contract

```css
:root {
  --font-allternit-sans: "Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif;
  --font-allternit-serif: "Allternit Serif", Georgia, ui-serif, serif;
  --font-allternit-mono: "Allternit Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace;

  --font-ui: var(--font-allternit-sans);
  --font-research: var(--font-allternit-serif);
  --font-code: var(--font-allternit-mono);
}
```

### 1.6 Component Contract

All text should use typography components, approved CSS utilities, or approved design token classes.

Allowed:

```tsx
<Text variant="body">Platform copy</Text>
<Text variant="researchBody">Research paragraph</Text>
<Text variant="code">agent.execute()</Text>
```

Forbidden:

```tsx
<div style={{ fontFamily: "Georgia" }}>
<div style={{ fontFamily: "Inter" }}>
```

---

## 2. Color System

### 2.1 Semantic Surface Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--surface-canvas` | `#fafafa` | `#0a0a0b` | Page background |
| `--surface-panel` | `#ffffff` | `#141416` | Cards, panels, modals |
| `--surface-floating` | `#ffffff` | `#1c1c1f` | Elevated elements, dropdowns |
| `--surface-active` | `#f3f4f6` | `#222225` | Hover/selected states |
| `--surface-hover` | `#e5e7eb` | `#2a2a2e` | Active press states |

### 2.2 Text Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ui-text-primary` | `#111111` | `#f0f0f0` | Headings, primary text |
| `--ui-text-secondary` | `#4b5563` | `#a1a1aa` | Body, descriptions |
| `--ui-text-muted` | `#9ca3af` | `#52525b` | Captions, placeholders |
| `--ui-text-inverse` | `#ffffff` | `#0a0a0b` | Text on dark/accent backgrounds |

### 2.3 Border Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ui-border-muted` | `#e5e7eb` | `#27272a` | Subtle dividers |
| `--ui-border-default` | `#d1d5db` | `#3f3f46` | Standard borders |
| `--ui-border-strong` | `#9ca3af` | `#52525b` | Focus rings, emphasis |

### 2.4 Status Tokens

| Token | Value | Usage |
|---|---|---|
| `--status-success` | `#22c55e` | Success, completed, online |
| `--status-warning` | `#f59e0b` | Warning, pending, attention |
| `--status-error` | `#ef4444` | Error, failed, offline |
| `--status-info` | `#3b82f6` | Info, active, in-progress |

### 2.5 Tier Tokens (A://Labs)

| Tier | Token | Hex | Usage |
|---|---|---|---|
| CORE | `--tier-core` | `#3b82f6` | Foundation courses |
| OPS | `--tier-ops` | `#8b5cf6` | Operations courses |
| AGENTS | `--tier-agents` | `#ec4899` | Agent systems courses |
| ADV | `--tier-adv` | `#f59e0b` | Advanced courses |

### 2.6 Accent Token

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--accent-primary` | `#7c3aed` | `#a78bfa` | Primary accent, CTAs, highlights |
| `--accent-secondary` | `#d97706` | `#fbbf24` | Secondary accent, warnings |

---

## 3. Spacing System

Base unit: `4px`

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Tight gaps, icon padding |
| `--space-2` | `8px` | Inline spacing, small gaps |
| `--space-3` | `12px` | Button padding, compact gaps |
| `--space-4` | `16px` | Card padding, section gaps |
| `--space-5` | `20px` | Medium section padding |
| `--space-6` | `24px` | Large card padding |
| `--space-8` | `32px` | Section padding |
| `--space-10` | `40px` | Hero padding |
| `--space-12` | `48px` | Major section breaks |

Container max-widths:
- `--container-sm`: `640px`
- `--container-md`: `768px`
- `--container-lg`: `1024px`
- `--container-xl`: `1280px`

Section padding:
- Mobile: `16px`
- Tablet: `24px`
- Desktop: `32px` — `48px`

---

## 4. Component Primitives

### 4.1 Button Variants

| Variant | Background | Border | Text | Hover |
|---|---|---|---|---|
| Primary | `var(--accent-primary)` | none | `var(--ui-text-inverse)` | `opacity: 0.9` |
| Secondary | transparent | `1px solid var(--ui-border-default)` | `var(--ui-text-primary)` | `var(--surface-active)` |
| Ghost | transparent | none | `var(--ui-text-secondary)` | `var(--surface-active)` |
| Danger | `var(--status-error)` | none | `var(--ui-text-inverse)` | `opacity: 0.9` |

### 4.2 Card Variants

| Variant | Background | Border | Shadow | Usage |
|---|---|---|---|---|
| Default | `var(--surface-panel)` | `1px solid var(--ui-border-muted)` | none | Standard cards |
| Elevated | `var(--surface-panel)` | `1px solid var(--ui-border-muted)` | `0 4px 16px rgba(0,0,0,0.08)` | Featured cards |
| Glass | `rgba(255,255,255,0.03)` | `1px solid rgba(255,255,255,0.06)` | none | Overlays, dark mode |

### 4.3 Tab Patterns

| Pattern | Indicator | Usage |
|---|---|---|
| Underline | `2px` bottom border | Primary nav, section tabs |
| Pill | filled rounded background | Filter chips, toggle groups |
| Sidebar | left border indicator | Settings, documentation |

### 4.4 Input States

| State | Border | Background | Ring |
|---|---|---|---|
| Default | `var(--ui-border-default)` | `var(--surface-panel)` | none |
| Focus | `var(--accent-primary)` | `var(--surface-panel)` | `2px solid var(--accent-primary)` |
| Error | `var(--status-error)` | `var(--surface-panel)` | `2px solid var(--status-error)` |
| Disabled | `var(--ui-border-muted)` | `var(--surface-active)` | none |

### 4.5 Badge Variants

| Variant | Background | Border | Text |
|---|---|---|---|
| Tier | `rgba(tier-color, 0.12)` | `1px solid rgba(tier-color, 0.25)` | `tier-color` |
| Status | `rgba(status-color, 0.12)` | `1px solid rgba(status-color, 0.25)` | `status-color` |
| Outline | transparent | `1px solid var(--ui-border-default)` | `var(--ui-text-secondary)` |

---

## 5. Elevation & Glass

### 5.1 Glassmorphism Rules

- Backdrop blur: `blur(12px)` minimum
- Background saturation: `saturate(180%)`
- Background opacity: `3%` — `8%` of surface color
- Border opacity: `6%` — `12%` of surface color
- Never use glass on top of busy/contrasting backgrounds without overlay

### 5.2 Shadow Scale

| Level | Shadow | Usage |
|---|---|---|
| 0 | none | Flat elements |
| 1 | `0 1px 3px rgba(0,0,0,0.04)` | Buttons, inputs |
| 2 | `0 4px 12px rgba(0,0,0,0.06)` | Cards, dropdowns |
| 3 | `0 8px 24px rgba(0,0,0,0.08)` | Modals, popovers |
| 4 | `0 12px 40px rgba(0,0,0,0.12)` | Drawers, side panels |
| 5 | `0 24px 64px rgba(0,0,0,0.16)` | Full-screen overlays |

### 5.3 When to Use Glass vs Solid

Use **glass** when:
- Element floats over dynamic content (video, maps, canvas)
- Element is an overlay or modal
- Dark mode with ambient glow effects

Use **solid** when:
- Element contains readable text blocks
- Element is a primary content container
- Light mode with high contrast requirements

---

## 6. Animation Standards

### 6.1 Duration Scale

| Token | Value | Usage |
|---|---|---|
| `--duration-micro` | `150ms` | Hover states, color changes |
| `--duration-standard` | `200ms` | Transitions, opacity, transforms |
| `--duration-emphasis` | `300ms` | Modals, drawers, page transitions |
| `--duration-complex` | `500ms` | Hero animations, onboarding |

### 6.2 Easing

| Token | Value | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard transitions |
| `--ease-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Entering elements |
| `--ease-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting elements |
| `--ease-reveal` | `cubic-bezier(0.16, 1, 0.3, 1)` | Scroll reveals, emphasis |

### 6.3 Reduced Motion

All animations must respect `@media (prefers-reduced-motion: reduce)`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Accessibility Requirements

### 7.1 Contrast

- Minimum text contrast: `4.5:1` for body text
- Minimum UI component contrast: `3:1` for borders, icons
- Large text (18px+ bold, 24px+ regular): `3:1` minimum

### 7.2 Focus Rings

- Width: `2px`
- Offset: `2px` from element edge
- Color: `var(--accent-primary)`
- Shape: match element border-radius

### 7.3 ARIA Patterns

- Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"`
- Dialogs: `role="dialog"`, `aria-modal="true"`
- Buttons: native `<button>` or `role="button"`, `tabIndex={0}`
- Navigation: `role="navigation"`, `aria-label` for context

### 7.4 Keyboard Navigation

- Tab order must follow visual order
- Arrow keys for list/grid navigation
- Escape to close modals, drawers, dropdowns
- Enter/Space to activate buttons and links

---

## 8. Surface-Specific Rules

### 8.1 A://Labs Design Contract

#### Tab Order
1. Discovery — feed, carousel, pipeline stats
2. Classroom — native lessons (OpenMAIC scenes)
3. Sources & Chat — OpenNotebook workspace
4. Tracks — course catalog by tier
5. Certifications — badge gallery

#### Tier Visual System
| Tier | Color Token | Hex | Icon | Usage |
|------|-------------|-----|------|-------|
| CORE | `--tier-core` | `#3b82f6` | Layers | Foundations |
| OPS | `--tier-ops` | `#8b5cf6` | BarChart3 | Operations |
| AGENTS | `--tier-agents` | `#ec4899` | Rocket | Agent systems |
| ADV | `--tier-adv` | `#f59e0b` | GraduationCap | Advanced |

#### Course Card Anatomy
- Cover image: `16:9`, `object-fit: cover`, gradient overlay
- Tier badge: top-left, glassmorphism, uppercase
- Module count: top-right, muted
- Title: serif, italic, `17px`, weight `900`
- Description: sans, `12.5px`, `3-line` clamp
- Capstone box: tinted background, border
- Actions: primary gradient CTA, secondary outline, icon-only external

#### Forbidden Patterns in A://Labs
- No inline `style={{}}` on components (use Tailwind + `cn()`)
- No hardcoded colors (use tokens)
- No arbitrary font sizes (use type scale)
- No `!important` in CSS

### 8.2 A://Research
- Body text: `var(--font-research)` (Allternit Serif)
- Headings: `research-display` or `research-heading`
- Citation styling: accent color, underline, source provenance
- Line length: maximum `75ch` for readability

### 8.3 Terminal / Agent Console
- Font: `var(--font-code)` (Allternit Mono)
- Background: `var(--surface-canvas)`
- ANSI color mapping must use platform tokens
- No serif or sans inside log output

### 8.4 Chat
- Bubble layout: user right, assistant left
- Avatar size: `32px`
- Timestamp format: `relative` (e.g. "2m ago")
- Code blocks: `var(--font-code)`, syntax highlighted

---

## 9. Migration Rules

When modifying existing UI, agents must:

1. Scan for hardcoded font names.
2. Replace direct font-family usage with tokens.
3. Replace arbitrary text classes with typography variants where possible.
4. Preserve content.
5. Validate no forbidden font patterns remain.
6. Attach validation output to the task report.

---

## 10. Agent Completion Criteria

A design system migration task is complete only when:

- No unauthorized `font-family` declarations remain
- No direct external font imports remain
- All text surfaces use the typography token system
- Research/editorial surfaces use serif correctly
- App UI uses sans correctly
- Code/log/protocol surfaces use mono correctly
- Color tokens are used instead of hardcoded hex values
- Spacing tokens are used instead of arbitrary pixel values
- Animation respects `prefers-reduced-motion`
- Focus rings are visible and consistent
- Validation script passes or blockers are documented
