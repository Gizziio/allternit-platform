---
name: mobile-app-design
description: "Mobile app UI/UX design skill. Generates frame structures, React Native / Expo component code, asset manifests, and navigation flows. Outputs Figma-compatible JSON and deploy-ready project scaffolds. Bridges to html-to-figma plugin for direct Figma export."
tags: ["mobile", "ui-ux", "react-native", "expo", "figma", "ios", "android"]
tools: ["llm", "filesystem", "browser"]
entrypoint: "SKILL.md"
---

# Mobile App Design

Design and scaffold production-ready mobile applications. This skill generates frame structures, component code, asset manifests, and navigation flows for iOS and Android. Output is optimized for Figma import via the html-to-figma plugin and for direct use in React Native / Expo projects.

> **STATUS:** Production  
> **No backend tool required.** This skill generates code and structured JSON entirely via LLM and filesystem.

---

## When to Use

- **New mobile app MVP** — building a greenfield iOS/Android app from concept to scaffold
- **Redesign of existing app** — overhauling UI/UX while preserving navigation and data layers
- **Adding a new feature flow** — onboarding, checkout, settings, or any multi-screen user journey
- **Design system creation for mobile** — establishing tokens, components, and platform patterns
- **App store screenshot generation** — producing framed mockups with safe-area-aware layouts
- **Prototyping for user testing** — clickable flows with real navigation structure and component states
- **Handoff from design to engineering** — Figma JSON + React Native code + asset checklist in one pass
- **Cross-platform (iOS/Android) alignment** — ensuring both platforms feel native while sharing logic

---

## Output Formats

Every invocation of this skill produces:

1. **Figma JSON** — structured frames, components, auto-layout specs compatible with the html-to-figma plugin
2. **React Native code** — screen components, navigation setup, styled-components or NativeWind classes
3. **Asset manifest** — icons, splash screens, adaptive icons, and app store assets for iOS/Android
4. **Navigation flow** — tab bars, stack navigators, modals, and deep link configuration

The agent should surface the scaffold path and Figma JSON first so the user can preview or import immediately.

---

## Design Principles

> **Core:** Every screen is a decision. Avoid the "AI-generated feel" by making bold choices and deleting everything else.

### 1. One hero per screen

Each screen has exactly one primary action or message. Everything else is secondary or absent. If the user cannot articulate the hero in one sentence, redesign before writing code.

### 2. Thumb zone priority

Primary actions live in the bottom 25% of the screen (easy-reach zone on a 6.1" device). Destructive or rarely-used actions go top-right or behind menus. Never center a primary CTA vertically.

### 3. Platform respect

iOS uses bottom sheets, page indicators, and swipe-back. Android uses dialogs, top app bars, and the system back gesture. Do not mix patterns blindly. When in doubt, follow the platform HIG (Human Interface Guidelines) or Material You spec.

### 4. 60fps feel

Every transition has a purpose. No decorative animation. Movement should communicate spatial relationships (push, present, dismiss) or state change (loading, success, error). Default to 200-300ms with ease-out curves.

### 5. Density discipline

Maximum 3 visible actions per screen. Maximum 5 items per visible list segment. If you need more, use pagination, search, or drill-down. Dense screens feel cheap and overwhelming.

---

## Platform Patterns

### iOS

| Element | Pattern | Notes |
|---------|---------|-------|
| **Icons** | SF Symbols | Use `weight="semibold"` for tab bars, `weight="regular"` for list rows |
| **Typography** | San Francisco | Large titles (34pt) on first level, 17pt body, 15pt secondary |
| **Navigation** | Bottom tab bar + stack | Tab bar always visible at root; stacks push from right |
| **Sheets** | Bottom sheet (medium/large detent) | Prefer sheets over full-screen modals for non-immersive flows |
| **Gestures** | Swipe-back, pull-to-refresh | Always preserve system gestures; do not block edge swipes |
| **Buttons** | Rounded rect, 44pt min | Prominent style for primary, plain for secondary |
| **Status bar** | 47pt (Dynamic Island) / 44pt (notch) | Respect safe area insets; never draw under the island |
| **Home indicator** | 34pt bottom safe area | Add bottom padding to all bottom-aligned controls |

### Android

| Element | Pattern | Notes |
|---------|---------|-------|
| **Icons** | Material Symbols | Outlined for inactive, filled for active states |
| **Typography** | Roboto / system font | H1 24sp, H2 20sp, Body 16sp, Caption 12sp |
| **Navigation** | Top app bar + bottom nav | Bottom nav for 3-5 top-level destinations; top bar for context actions |
| **FAB** | Floating Action Button | One per screen, primary action, bottom-right above nav |
| **Dialogs** | Centered alert / bottom sheet | Alerts for decisions, bottom sheets for additional options |
| **Gestures** | System back gesture | Predictable back behavior; do not override unless immersive |
| **Buttons** | Contained / text / outlined | Contained for primary, text for secondary, outlined for tertiary |
| **Status bar** | 24dp | Translucent or match surface color; handle edge-to-edge in Android 15+ |
| **Navigation bar** | 48dp (gesture) / 80dp (3-button) | Respect system gesture insets |

### Cross-platform

| Concern | Recommendation |
|---------|----------------|
| **Router** | Expo Router (file-based) or React Navigation (config-based) |
| **Styling** | NativeWind (Tailwind for RN) or styled-components with platform variants |
| **Safe areas** | `react-native-safe-area-context` — always wrap root in `SafeAreaProvider` |
| **Platform variants** | `Platform.select()` or NativeWind `ios:` / `android:` prefixes |
| **Icons** | `lucide-react-native` or `@expo/vector-icons` with platform mapping |
| **Gestures** | `react-native-gesture-handler` + `react-native-reanimated` for custom transitions |

---

## Agent Workflow

Follow this 5-step workflow when designing a mobile app:

### Step 1: Discover

Clarify with the user (or infer from prompt):
- **Platform**: iOS only, Android only, or both (cross-platform)
- **Audience**: consumer, pro-user, internal tool, B2B
- **Core user story**: the one sentence describing what the app does and for whom
- **Monetization / auth model**: free, subscription, one-time purchase, SSO — affects onboarding flow
- **Existing brand assets**: colors, logos, illustration style, or starting from scratch

If the prompt is vague (e.g., "build a fitness app"), ask for the core user story before proceeding.

### Step 2: Architect

Generate the information architecture:

```json
{
  "appName": "FitPulse",
  "platforms": ["ios", "android"],
  "screens": [
    { "name": "Home", "type": "tab-root", "hero": "Today's workout" },
    { "name": "WorkoutDetail", "type": "stack", "hero": "Start session" },
    { "name": "Profile", "type": "tab-root", "hero": "View stats" },
    { "name": "Settings", "type": "modal", "hero": "Adjust preferences" }
  ],
  "flows": [
    { "name": "Onboarding", "steps": ["Welcome", "GoalSelect", "Permission", "Signup"] },
    { "name": "Workout", "steps": ["Home", "WorkoutDetail", "ActiveSession", "Summary"] }
  ],
  "states": ["empty", "loading", "error", "success", "partial"]
}
```

Show the architecture to the user for approval before framing screens.

### Step 3: Frame

Design key screens with platform constraints:

- **Canvas size**: 393 × 852 pt (iPhone 15 Pro) or 360 × 800 dp (Android baseline)
- **Safe areas**: Respect top and bottom insets; never place tappable elements in danger zones
- **Notch / Dynamic Island**: 47pt top inset on iOS; draw backgrounds edge-to-edge but keep text/icon inside safe area
- **Home indicator / gesture bar**: 34pt bottom inset on iOS; 48dp on Android
- **Frame structure**: Each screen = Figma frame with auto-layout, named `Screen/{Name}`

For each screen, define:
- Hero element (position, size, priority)
- Action set (max 3 visible actions)
- Scroll behavior (fixed header? collapsible?)
- Empty state and error state

### Step 4: Componentize

Extract reusable components from the framed screens:

| Component | Props | Platform Notes |
|-----------|-------|----------------|
| `Button` | variant, size, icon, disabled | iOS: rounded rect; Android: contained/elevated |
| `Card` | image, title, subtitle, action | Shadow on iOS, elevation on Android |
| `Input` | label, placeholder, error, icon | iOS: borderless with separator; Android: outlined or filled |
| `ListItem` | icon, title, subtitle, trailing | iOS: chevron right; Android: no chevron unless navigable |
| `Avatar` | size, source, fallback | Circular on both platforms |
| `Badge` | text, color | Small pill, high contrast |
| `TabBar` | tabs, activeIndex | iOS: bottom, labels + icons; Android: bottom or top |
| `TopBar` | title, back, actions | iOS: large title optional; Android: always present with back |
| `BottomSheet` | children, snapPoints | iOS: medium/large detents; Android: half/full |

Write each component with platform-specific variants using `Platform.select` or NativeWind prefixes.

### Step 5: Export

Generate all deliverables:

1. **Figma JSON** — structured frames with auto-layout, named layers, component refs
2. **React Native scaffold** — Expo Router or React Navigation project structure
3. **Asset checklist** — icons, splash, adaptive icons, app store screenshots
4. **Navigation config** — deep links, tab/stack/modal definitions

Deliver to user:
- Path to scaffold directory
- Figma JSON snippet (or file path)
- Asset checklist with required sizes
- Summary of screens and components generated

---

## Figma Bridge

Push designs to Figma using the existing html-to-figma plugin:

```
1. Generate HTML preview of the design (static markup with inline styles representing the screen)
2. Call html-to-figma:deep-capture with the HTML and target Figma file URL
3. Agent receives Figma node IDs and confirms structure
```

### How it works

The html-to-figma plugin (`~/.allternit/plugins/html-to-figma-opensource/`) converts DOM nodes to Figma nodes. To bridge a mobile design:

1. **Build an HTML preview** that mirrors the mobile frame — use a wrapper div sized to 393×852 pt (or 360×800 dp) with `position: relative` and mobile-safe CSS.
2. **Ensure semantic structure** — the plugin reads DOM hierarchy and translates it to Figma layers. Group related elements in containers.
3. **Use computed styles** — inline styles or computed CSS work best. Avoid dynamic classes that depend on external stylesheets.
4. **Call the plugin** via the Allternit browser tool or agent command interface with the HTML string and target Figma file URL.
5. **Verify node IDs** — confirm that frames, components, and auto-layout groups imported correctly.

**Tip:** For complex designs, export screen-by-screen rather than all at once. Name each root frame `Screen/{Name}` so the Figma layer tree is organized.

---

## React Native Scaffold Template

Base project structure for an Expo Router project:

```
app/
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator configuration
│   ├── index.tsx            # Home tab screen
│   └── profile.tsx          # Profile tab screen
├── (stack)/
│   ├── _layout.tsx          # Stack navigator configuration
│   └── detail.tsx           # Detail / push screen
├── components/
│   ├── Button.tsx           # Primary, secondary, disabled variants
│   ├── Card.tsx             # Image + text card with platform shadow
│   └── Input.tsx            # Labeled input with error state
├── constants/
│   └── theme.ts             # Colors, spacing, typography tokens
└── assets/
    ├── icons/
    │   ├── icon.png         # App icon (1024×1024)
    │   ├── adaptive-icon.png # Android adaptive icon foreground
    │   └── favicon.png
    └── images/
        ├── splash.png       # Splash screen (1242×2436)
        └── ...
```

### Theme constants example

```typescript
// constants/theme.ts
export const theme = {
  colors: {
    primary: '#007AFF',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    danger: '#FF3B30',
    success: '#34C759',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 999,
  },
  typography: {
    largeTitle: { fontSize: 34, fontWeight: '700' as const },
    title1: { fontSize: 28, fontWeight: '700' as const },
    title2: { fontSize: 22, fontWeight: '700' as const },
    body: { fontSize: 17, fontWeight: '400' as const },
    callout: { fontSize: 16, fontWeight: '400' as const },
    subhead: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
  },
};
```

### Safe area wrapper

```tsx
// app/_layout.tsx
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
```

---

## Quick Reference

### Dimensions & Safe Areas

| Measurement | iOS | Android |
|-------------|-----|---------|
| **Status bar** | 47 pt (Dynamic Island) / 44 pt (notch) | 24 dp |
| **Home indicator / gesture nav** | 34 pt bottom safe area | 48 dp (gesture) / 80 dp (3-button) |
| **Touch target min** | 44 × 44 pt | 48 × 48 dp |
| **Tab bar height** | 49 pt + 34 pt safe area | 80 dp (with label) |
| **Top app bar** | 44 pt (compact) / 96 pt (large title) | 64 dp |

### Typography Scale

**iOS (San Francisco):**

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| Large Title | 34 pt | Bold | First-level screen header |
| Title 1 | 28 pt | Bold | Modal headers |
| Title 2 | 22 pt | Bold | Section headers |
| Body | 17 pt | Regular | Primary text |
| Callout | 16 pt | Regular | List items, buttons |
| Subhead | 15 pt | Regular | Secondary labels |
| Caption | 13 pt | Regular | Metadata, timestamps |

**Android (Roboto / system):**

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 24 sp | Bold | Screen title |
| H2 | 20 sp | Bold | Section header |
| H3 | 18 sp | Medium | Card title |
| Body | 16 sp | Regular | Primary text |
| Caption | 12 sp | Regular | Metadata, hints |

### Asset Sizes

| Asset | iOS | Android |
|-------|-----|---------|
| App icon | 1024 × 1024 pt (AppIcon.appiconset) | 512 × 512 dp (mipmap-xxxhdpi) |
| Splash screen | 1242 × 2436 px (3×) | 1440 × 2560 px (xxhdpi) |
| Adaptive icon | N/A | 108 × 108 dp foreground + background |
| App store screenshots | 6.5" (1290 × 2796), 6.7" (1320 × 2868) | 1080 × 1920 (phone), 1440 × 2560 (7" tablet) |

### Animation Defaults

| Transition | Duration | Easing | Platform |
|------------|----------|--------|----------|
| Screen push | 300 ms | ease-out | Both |
| Modal present | 350 ms | spring | iOS |
| Bottom sheet | 250 ms | ease-out | Both |
| Button press | 100 ms | ease-in-out | Both |
| Toast / snackbar | 200 ms in, 300 ms out | ease-out | Both |

---

## What to Avoid

| Pattern | Problem | Alternative |
|---------|---------|-------------|
| Hamburger menu on primary nav | Hides core actions | Bottom tab bar (3-5 items) |
| Centered primary CTA | Unreachable one-handed | Bottom 25% of screen |
| Decorative gradients / blobs | AI-generated feel | Solid color or subtle texture |
| More than 3 actions per screen | Cognitive overload | Prioritize or use overflow menu |
| Shadow on Android cards | iOS pattern leaking | Use `elevation` instead |
| Full-screen modals for minor choices | Heavy, disruptive | Bottom sheet or inline expansion |
| Custom back button behavior | Breaks muscle memory | Follow platform convention |
| Ignoring safe areas | Content under notch/home bar | `react-native-safe-area-context` |
| Mixed platform patterns (iOS tabs + Android drawer) | Confusing, non-native | Commit to platform convention |
| `animate-bounce` or pulsing loaders | Distracting, cheap | Subtle opacity or scale transitions |

---

## Pre-Delivery Checklist

- [ ] Core user story is articulated in one sentence
- [ ] Each screen has exactly one hero element
- [ ] Primary actions are in the bottom 25% of the screen
- [ ] Platform patterns respected (iOS bottom sheets, Android dialogs, etc.)
- [ ] Safe areas handled for notch, Dynamic Island, and home indicator
- [ ] Touch targets meet minimums (44 pt / 48 dp)
- [ ] Max 3 visible actions per screen, max 5 items per visible list
- [ ] Empty, loading, and error states designed for each screen
- [ ] Figma JSON uses auto-layout and named frames
- [ ] React Native scaffold includes `SafeAreaProvider`
- [ ] Asset checklist provided with all required sizes
- [ ] Navigation flow includes deep link configuration
- [ ] No decorative animation without purpose
