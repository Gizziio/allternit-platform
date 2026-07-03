# Craft — Color

Universal color rules that apply regardless of brand.

## Accent budget
One accent color, used at most twice per screen. A second color is only allowed as a functional signal (success/warn/danger).

## Background hierarchy
- Background: the page canvas.
- Surface: cards, panels, elevated sheets.
- Foreground: primary text and icons.
- Muted: secondary text, disabled states, subtle borders.
- Border: dividers and outlines.
- Accent: primary CTA and one editorial flourish.

## Deriving colors
When extending a palette, derive with OKLch rather than inventing hex from memory. Adjust lightness and chroma while keeping hue consistent.

## Default dark mode
- Never use cold deep navy (#0D1117, #050505) as the default dark — it reads as generic AI dark.
- Prefer near-black with a warm (amber) or violet undertone.

## AI-default tells
- #6366f1 (Tailwind indigo) is the AI-default accent — avoid as a brand color.
- Purple→blue→cyan gradients signal "trust gradient" — use only when the brief explicitly asks for it.

## Contrast
- Body text vs background: 4.5:1 minimum.
- Large text: 3:1 minimum.
- Do not rely on color alone for state — supplement with icon, text, or pattern.

## Opacity
- Use opacity for hover/disabled states, not lighter hex values that drift out of the palette.
- Keep disabled text ≥ 0.38 opacity against its background for legibility.

## Avoid
- Holographic or rainbow gradient overlays without a clear narrative purpose.
- A gradient on every background — pick one decisive gradient per design, max.
- Three perfectly equal-width colored bands as a default hero.
