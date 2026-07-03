# Craft — Typography

Universal typography rules that apply regardless of brand.

## Scale
Use a modular scale. Default product scale:
- 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 px

Resist adding intermediate sizes. If a design needs 18px, prefer 16px or 20px and adjust weight or color instead.

## Display vs body
- Display face carries personality — pick one with a clear voice.
- Body face carries information — it must disappear while reading.
- They should be from different categories (serif/sans, or strong weight contrast within one family).

## Line length
45–75 characters for body text. Never stretch a single-column body to full viewport width.

## Line height
- Body text: 1.5–1.65
- Headlines: 1.0–1.15 (tighter at larger sizes)
- Never `line-height: 1` on multi-line text.

## Letter spacing
- Headlines ≥ 32px: −0.02em to −0.04em
- ALL-CAPS labels: +0.08em minimum
- Body text: 0 (do not track body)

## Hierarchy
One dominant element per screen. Everything else defers to it. If two things compete for dominance, one is wrong.

## Contrast
- Body text minimum 4.5:1 vs background (WCAG AA).
- Large text (≥18px bold) minimum 3:1.
- Use OKLch lightness difference to verify when possible.

## Numeric styling
- Use `font-variant-numeric: tabular-nums` for tables, dashboards, and any aligned numbers.
- Mono for code, IDs, hashes, and technical readouts.

## Avoid
- Inter / Roboto / Arial as a *display* face (body is fine).
- ALL-CAPS body text without explicit letter-spacing ≥ 0.08em.
- Centered body text blocks — center is for short labels, headings, and CTAs only.
- Justified text in UI copy.
