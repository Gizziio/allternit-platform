# Stage Slot Specification

## Overview

A "Stage" is a dedicated region for high-performance web content that requires GPU acceleration. Unlike capsules which float in the workspace, a Stage is a managed surface with specific sizing and positioning constraints designed for immersive content consumption.

## Key Characteristics

### Anti-Sprawl Design
- **One Stage per workspace** - Only one active Stage at any time
- **Explicit sizing** - Users choose from predefined size presets
- **Clear boundaries** - Stage has visible header and controls
- **Explicit close** - Users must intentionally close Stage

### Animation Philosophy
- **Smooth transitions** - Enter/exit animations with rect interpolation
- **No jarring cuts** - Fade and scale transitions
- **Predictable motion** - Consistent easing curves
- **Duration limits** - Maximum 400ms for any animation

## Size Presets

| Preset | Width | Height | Use Case |
|--------|-------|--------|----------|
| **50%** | 50% of screen width | 60% of screen height | Picture-in-picture style, background viewing |
| **70%** | 70% of screen width | 80% of screen height | Default stage view, balanced immersion |
| **100%** | 95% of screen width | 95% of screen height | Full immersion, primary content viewing |

### Size Calculation Formula
```
stageWidth = min(screenWidth - padding * 2, maxWidth)
stageHeight = min(screenHeight - padding * 2, maxHeight)

where:
  padding = 60px
  maxWidth = 1920px
  maxHeight = 1080px
```

### Position Calculation Formula
```
stageLeft = max(20, (screenWidth - stageWidth) / 2)
stageTop = max(20, (screenHeight - stageHeight) / 2)
```

## Visual Structure

```
┌────────────────────────────────────────────────────────┐
│ 🎬 Stage                          [50%] [70%] [100%] ✕ │
├────────────────────────────────────────────────────────┤
│  domain.com                              ● Ready      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │                                                  │ │
│  │              GPU-Accelerated Content             │ │
│  │                                                  │ │
│  │    (Video player, WebGL canvas, etc.)           │ │
│  │                                                  │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Header Elements
1. **Icon** (left) - Stage icon (🎬)
2. **Title** (left) - Current page title or domain
3. **Loading indicator** (left) - Spinner during navigation
4. **Size preset buttons** (right) - 50%, 70%, 100% toggle
5. **Close button** (far right) - ✕ to close Stage

### Floating Controls
- Positioned at bottom center of Stage
- Shows current URL (truncated)
- Shows status indicator (colored dot)
- Appears after 500ms delay
- Fades out when not in use

## Animation Sequences

### Enter Animation (400ms total)

```
0ms    Container opacity: 0 → 1
        Pointer events: disabled → enabled
        Stage content: scale 0.95 → 1.0
                       opacity: 0 → 1
        Easing: cubic-bezier(0.4, 0, 0.2, 1)

200ms  Stage content: fully visible

500ms  Floating controls: opacity 0 → 1
        Pointer events: disabled → enabled
```

### Exit Animation (400ms total)

```
0ms    Floating controls: opacity 1 → 0
        Pointer events: enabled → disabled

200ms  Stage content: scale 1.0 → 0.95
        opacity: 1 → 0

400ms  Container: opacity 1 → 0
        Pointer events: enabled → disabled
```

### Size Change Animation (300ms)

```
0ms    Stage content: scale 0.95 → 0.95
        opacity: 1 → 0

150ms  Stage content: scale 1.0 → 1.0
        opacity: 0 → 1
```

## API Reference

### StageSlot Class

```typescript
class StageSlot {
  // Create a new StageSlot instance
  constructor(config?: StageConfig)

  // Render and mount to DOM
  createView(spec: ViewSpec): HTMLElement

  // Open URL in Stage
  open(url: string): Promise<void>

  // Close Stage
  close(): void

  // Change size preset
  setSizePreset(preset: '50%' | '70%' | '100%'): void

  // Navigate to new URL
  navigate(url: string): void

  // Set page title
  setTitle(title: string): void

  // Show error state
  showError(message: string): void

  // Register close callback
  onStageClose(callback: () => void): void

  // Register URL change callback
  onUrlChange(callback: (url: string) => void): void

  // Cleanup and destroy
  destroy(): void
}
```

### StageConfig Interface

```typescript
interface StageConfig {
  url?: string;           // Initial URL
  sizePreset?: '50%' | '70%' | '100%';  // Default size
  closable?: boolean;     // Allow closing (default: true)
}
```

### StageState Interface

```typescript
interface StageState {
  isActive: boolean;      // Whether Stage is open
  sizePreset: '50%' | '70%' | '100%';  // Current size
  url: string;            // Current URL
  title: string;          // Page title
  isLoading: boolean;     // Navigation in progress
  error?: string;         // Error message if any
}
```

## Usage Examples

### Basic Usage

```typescript
import { createStageSlot } from './StageSlot';

const stage = createStageSlot({
  url: 'https://youtube.com/watch?v=...',
  sizePreset: '70%',
});

document.body.appendChild(stage.createView({ bindings: { data: {} } }));
stage.open('https://youtube.com/watch?v=...');
```

### With Callbacks

```typescript
const stage = createStageSlot({
  url: 'https://twitch.tv/channel',
  sizePreset: '100%',
});

stage.onStageClose(() => {
  console.log('Stage closed');
  // Cleanup, update UI state, etc.
});

stage.onUrlChange((url) => {
  console.log('Navigated to:', url);
  // Update analytics, history, etc.
});
```

### Size Change

```typescript
// Cycle through sizes
const sizes: StageSizePreset[] = ['50%', '70%', '100%'];
let currentSizeIndex = 1;

button.onclick = () => {
  currentSizeIndex = (currentSizeIndex + 1) % sizes.length;
  stage.setSizePreset(sizes[currentSizeIndex]);
};
```

## Integration with BrowserView

### Button Integration

The Stage button is added to the BrowserView header:

```typescript
private createStageButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.innerHTML = '🎬';
  btn.title = 'Stage - Open in dedicated Stage for video/WebGL';
  btn.onclick = () => this.openInStage();
  return btn;
}

private openInStage(): void {
  const currentTab = this.tabs.get(this.activeTabId);

  if (!this.stageSlot) {
    this.stageSlot = createStageSlot({
      url: currentTab?.url,
      sizePreset: this.stageSizePreset,
    });

    this.stageSlot.onStageClose(() => {
      this.isStageActive = false;
      this.stageSlot = null;
    });

    document.body.appendChild(this.stageSlot.createView({ bindings: { data: {} } }));
  }

  if (this.stageSlot && currentTab) {
    this.stageSlot.open(currentTab.url);
    this.isStageActive = true;
  }
}
```

## Design Guidelines

### When to Use Stage

**Use Stage for:**
- Video playback (YouTube, Vimeo, etc.)
- WebGL applications (Three.js, games)
- Interactive visualizations
- Full-bleed content
- Immersive experiences

**Use regular browser capsule for:**
- Reading articles
- Quick searches
- Tab-based browsing
- Text-heavy content
- Simple interactions

### Performance Considerations

- Stage uses iframe for GPU rendering
- Only one Stage active at a time
- Stage is appended to document.body (not inside capsule)
- Cleanup is critical - always call destroy()
- Monitor memory usage with multiple navigations

### Accessibility

- All buttons have aria-labels
- Keyboard navigation support
- Focus management on open/close
- Color contrast for status indicators
- Screen reader announcements for state changes

## Testing Checklist

### Visual Tests
- [ ] Stage opens with smooth animation
- [ ] Stage closes with smooth animation
- [ ] Size change transitions are smooth
- [ ] Header is properly styled
- [ ] Floating controls appear after delay
- [ ] Backdrop is visible behind Stage

### Functional Tests
- [ ] URL navigation works in Stage
- [ ] Page title updates correctly
- [ ] Loading indicator shows during navigation
- [ ] Error state displays properly
- [ ] Size preset buttons work
- [ ] Close button works
- [ ] Only one Stage can be open

### Edge Cases
- [ ] Opening Stage when one is already open
- [ ] Closing Stage from close button
- [ ] Navigating away while Stage is open
- [ ] Rapid open/close cycles
- [ ] Opening Stage with invalid URL
- [ ] Network error during navigation

## Browser Support

- **macOS**: Full support (WKWebView via iframe)
- **Windows**: Full support (WebView2 via iframe)
- **Linux**: Full support (WebKitGTK via iframe)
- **Tauri**: Full native support
- **Web**: Fallback to iframe-based rendering

## Related Files

| File | Purpose |
|------|---------|
| `apps/ui/src/views/StageSlot.tsx` | StageSlot implementation |
| `apps/ui/src/views/BrowserView.ts` | Browser capsule with Stage integration |
| `docs/BROWSER_CAPSULE_GOLD_STANDARD.md` | Complete browser spec |
