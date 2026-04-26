# allternit Brand Identity Guide

## Brand Philosophy

**allternit** represents the convergence of artificial intelligence and agentic systems. 
The brand communicates: precision, sophistication, innovation, and professionalism.

---

## Color Palette

### Primary Palette (Use These Exclusively)

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary Accent** | Cyan | `#00d4ff` | CTAs, links, highlights, primary buttons |
| **Secondary Accent** | Purple | `#8338ec` | Gradients, secondary elements, emphasis |
| **Tertiary Accent** | Magenta | `#ff006e` | Important alerts, key metrics |

### Background Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Deep Void** | Near Black | `#0a0a0f` | Page background |
| **Surface** | Dark | `#12121a` | Cards, containers |
| **Elevated** | Lighter Dark | `#1e1e2e` | Modals, dropdowns |
| **Border** | Subtle | `#2a2a3e` | Dividers, borders |

### Neutral/Text Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary Text** | White | `#ffffff` | Headings, important text |
| **Secondary Text** | Light Gray | `#a0a0b0` | Body text, descriptions |
| **Tertiary Text** | Muted | `#6b6b7b` | Meta info, captions |

### Functional Colors

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Success** | Green | `#06ffa5` | Success states, completion |
| **Warning** | Yellow | `#ffbe0b` | Warnings, attention |
| **Error** | Red | `#ff4444` | Errors, critical alerts |

---

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| H1 | 42px | 800 | 1.1 | -0.02em |
| H2 | 32px | 700 | 1.2 | -0.01em |
| H3 | 24px | 600 | 1.3 | 0 |
| H4 | 18px | 600 | 1.4 | 0 |
| Body | 16px | 400 | 1.7 | 0 |
| Small | 14px | 400 | 1.6 | 0 |
| Caption | 12px | 500 | 1.5 | 0.02em |

---

## Visual Elements

### Gradients

```css
/* Primary Hero Gradient */
background: linear-gradient(135deg, #00d4ff 0%, #8338ec 100%);

/* Subtle Glow */
box-shadow: 0 0 40px rgba(0, 212, 255, 0.15);

/* Card Accent Border */
border: 1px solid #2a2a3e;
border-top: 2px solid #00d4ff;
```

### Cards

```css
.allternit-card {
  background: #12121a;
  border: 1px solid #2a2a3e;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
}

.allternit-card:hover {
  border-color: rgba(0, 212, 255, 0.3);
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.1);
}
```

### Buttons

```css
/* Primary Button */
.allternit-btn-primary {
  background: linear-gradient(135deg, #00d4ff, #0099cc);
  color: #0a0a0f;
  padding: 12px 28px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
}

/* Secondary Button */
.allternit-btn-secondary {
  background: transparent;
  color: #00d4ff;
  padding: 12px 28px;
  border-radius: 8px;
  border: 1px solid #00d4ff;
  font-weight: 600;
}
```

---

## Imagery Guidelines

### Course Preview Cards

**Dimensions:** 800x450px (16:9 ratio)
**Style:** Abstract tech imagery, neural network visualizations, dark theme
**Color Treatment:** Cyan/blue tint overlay on dark backgrounds

### Image Categories

1. **Hero Images** - Abstract AI/network visualizations
2. **Module Thumbnails** - Consistent style with module numbers
3. **Iconography** - Lucide icons, 24px, cyan/white color

### Image Treatment

- Dark overlays (60-80% opacity)
- Cyan accent lighting
- Geometric patterns
- Clean, minimal composition

---

## Layout Principles

### Spacing Scale

| Name | Value | Usage |
|------|-------|-------|
| xs | 4px | Tight gaps |
| sm | 8px | Internal spacing |
| md | 16px | Component padding |
| lg | 24px | Card padding |
| xl | 32px | Section spacing |
| 2xl | 48px | Major sections |
| 3xl | 64px | Page sections |

### Container

```css
max-width: 1000px;
margin: 0 auto;
padding: 0 24px;
```

---

## Content Guidelines

### Terminology

| Use This | Not This |
|----------|----------|
| A://labs | Canvas, generic LMS |
| allternit protocol | Generic platform references |
| Protocol Forum | Discussion board, forum |
| Agentic systems | AI agents (use sparingly) |
| Initialize | Start, begin |
| Synchronize | Update, refresh |

### Tone

- **Professional** but approachable
- **Technical** but accessible
- **Precise** without being pedantic
- **Forward-looking** without hype

---

## Component Library

### Course Card

```html
<div class="course-card">
  <div class="course-image">
    <span class="module-number">01</span>
    <div class="course-overlay"></div>
  </div>
  <div class="course-content">
    <h3>Module Title</h3>
    <p>Description</p>
    <span class="duration">4-5 hours</span>
  </div>
</div>
```

### Info Box

```html
<div class="info-box info-box-cyan">
  <h4>💡 Key Concept</h4>
  <p>Content here</p>
</div>
```

### Code Block

```html
<div class="code-block">
  <pre><code>print("Hello, allternit")</code></pre>
</div>
```

---

## Platform Integration

### A://labs Specific

- Breadcrumb: `A://labs > Courses > AI-101 > Module 1`
- Navigation: Left sidebar with progress indicators
- Cards: Use allternit-card class
- Buttons: Use allternit-btn classes

### Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Mobile | < 640px | Single column, reduced padding |
| Tablet | 640-1024px | Two columns where applicable |
| Desktop | > 1024px | Full layout |

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Focus states: 2px solid #00d4ff outline
- Alt text required for all images
- Keyboard navigation supported
- Screen reader friendly structure

---

## File Naming

```
component-name.html
module-01-overview.html
lesson-1-1-content.html
allternit-brand.css
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-04-12  
**Protocol:** allternit v1.0
