# Craft — Anti-AI-Slop

Universal anti-patterns. Never ship these unless the brief explicitly asks for them.

## Visual sins
- Aggressive purple/violet gradient backgrounds (the "trust gradient").
- Generic emoji feature icons (✨ 🚀 🎯 💡) — they read as placeholders.
- Rounded card with a left coloured border accent — it is a framework default, not a decision.
- Hand-drawn SVG humans / faces / scenery without explicit request.
- Cyber neon / cold deep navy (#0D1117, #050505) as default dark mode.
- Holographic or rainbow gradient overlays without narrative purpose.
- Three perfectly equal-width columns as a default grid.

## Typography sins
- Inter / Roboto / Arial as a display face.
- ALL-CAPS body text without letter-spacing ≥ 0.08em.
- Centered body text blocks.

## Copy sins
- Lorem ipsum, "Feature One / Feature Two / Feature Three", or any placeholder text.
- Invented metrics without a source: "10× faster", "99.9% uptime", "trusted by 50,000 teams".
- Vague benefit statements: "unlock your potential", "supercharge your workflow".

## Interaction sins
- `scrollIntoView()` calls — they fight the user's scroll position.
- Auto-playing video or audio without user consent.
- Modal dialogs that cannot be closed with Escape.
- Hidden hover-only actions with no keyboard equivalent.

## Layout sins
- A gradient on every background.
- Icons next to every heading.
- Decorative blobs that do not relate to content.
- Fake depth with multiple overlapping drop shadows.

## When a value is missing
Leave an honest stub: a grey block, an em dash, or a `[METRIC]` label. Never invent.
