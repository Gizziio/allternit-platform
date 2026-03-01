---
title: "A2rchitech Session Summary — Onboarding & Login Fun (Login Arcade)"
date: "2026-01-26"
topic: "onboarding-login-fun"
scope: ["auth", "onboarding", "ui", "game", "canvas"]
status: "session-summary"
---

# Purpose
Add a lightweight, 2D, Sonic-like microgame to the **Sign In / Register** screens to reduce friction and increase delight, while keeping authentication fully usable.

# Visual direction (concepts)

## Concept v1 — Full scene
![Concept v1](./concept_v1_full_scene.png)

## Concept v2 — Simplified
![Concept v2](./concept_v2_simplified_light.png)

## Concept v3 — Dark + logo depth (target)
![Concept v3](./concept_v3_dark.png)

# Product constraints
- Auth form always usable.
- Ambient attract mode by default.
- One-input control.
- Mobile-safe performance.
- Dark background, logo-only scenery with parallax depth.

# Login Arcade rotation
Random microgame chosen on refresh using seeded RNG.

Rotation modes:
- refreshRandom
- sessionSticky (default)
- daily

# Microgame pool
Runner Jump, Jetpack Hover, Shield Timing, Wave Dodge, Rhythm Gates, Grapple Swing,
Lane Switch Runner, Pong Solo, Asteroid Drift, Stack Balance.

# Depth tricks
Parallax layers, fog/vignette, glow halo, scale-speed coupling.

# Build blueprint
Single engine + swappable modes.

Modules export:
id, title, weight, init, update, render, teardown.

File layout:
components/LoginArcade.tsx
game/engine.ts
game/modes/*
game/modeRegistry.ts
game/modePicker.ts

v1 modes:
runner_jump
jetpack_hover
shield_timing
