# Browser Capsule QA Checklist - Stage & Boost

## Test Environment Setup

```bash
# Start browser runtime
cd services/browser-runtime
pnpm dev

# Start shell app
cd apps/shell
pnpm dev

# Open http://localhost:5173
# Click Browser capsule (🌐) in left rail
```

## Stage Slot Tests

### Stage-01: Basic Stage Opening
- [ ] Click Stage (🎬) button in browser header
- [ ] Stage overlay appears with animation
- [ ] Current tab URL loads in Stage
- [ ] Stage header shows domain name
- [ ] Size preset shows "70%" by default
- [ ] Close button (✕) is visible

### Stage-02: Stage Animation
- [ ] Stage opens with smooth scale/fade animation
- [ ] Animation duration is ~400ms
- [ ] Floating controls appear after ~500ms
- [ ] Stage closes with reverse animation
- [ ] Animation easing is smooth (cubic-bezier)

### Stage-03: Size Presets
- [ ] Click "50%" button → Stage resizes to 50%
- [ ] Click "70%" button → Stage resizes to 70%
- [ ] Click "100%" button → Stage resizes to 100%
- [ ] Resize animation is smooth
- [ ] Stage stays centered when resizing

### Stage-04: Stage Navigation
- [ ] Navigate within Stage using browser controls
- [ ] Back button works in Stage
- [ ] Forward button works in Stage
- [ ] Reload button works in Stage
- [ ] URL bar updates on navigation

### Stage-05: Stage Closing
- [ ] Click close button (✕) → Stage closes
- [ ] Stage closes with animation
- [ ] Returns to browser capsule view
- [ ] Can reopen Stage after closing
- [ ] Only one Stage can be open (anti-sprawl)

### Stage-06: Multiple Tab Navigation
- [ ] Open multiple tabs in browser
- [ ] Navigate to different URLs
- [ ] Click Stage button → Current tab loads in Stage
- [ ] Switch tabs while Stage is open
- [ ] Stage shows correct tab content

### Stage-07: Video Playback in Stage
- [ ] Open YouTube in Stage
- [ ] Video plays smoothly
- [ ] Fullscreen button works
- [ ] Playback controls are responsive
- [ ] No lag or stuttering

### Stage-08: WebGL Content in Stage
- [ ] Open Three.js example in Stage
- [ ] 3D content renders correctly
- [ ] Mouse interaction works
- [ ] No screenshot artifacts (full GPU)

### Stage-09: Error Handling
- [ ] Navigate to invalid URL → Error shown
- [ ] Error message is readable
- [ ] Can close Stage after error
- [ ] Can navigate away from error

### Stage-10: Loading States
- [ ] Loading spinner appears on navigation
- [ ] Loading indicator is visible
- [ ] Spinner disappears when loaded
- [ ] Status dot shows loading state

## GPU Boost Tests

### Boost-01: Boost Button Visibility
- [ ] Boost button (⚡) is visible in header
- [ ] Button has proper styling
- [ ] Hover state works
- [ ] Tooltip shows on hover

### Boost-02: Toggle Boost On
- [ ] Click Boost button → Button highlights
- [ ] Renderer switches to GPU mode
- [ ] Status indicator updates to "GPU"
- [ ] Current URL continues in GPU mode

### Boost-03: Toggle Boost Off
- [ ] Click Boost button again → Button unhighlights
- [ ] Renderer switches back to Stream mode
- [ ] Status indicator updates to "Stream"
- [ ] Current URL continues in Stream mode

### Boost-04: Video with Boost
- [ ] Enable Boost on YouTube
- [ ] Video plays smoothly
- [ ] Full GPU acceleration active
- [ ] Better performance than Stream mode

### Boost-05: WebGL with Boost
- [ ] Enable Boost on Three.js
- [ ] 3D rendering uses GPU
- [ ] Smoother frame rate
- [ ] Better performance than Stream mode

### Boost-06: Boost State Persistence
- [ ] Toggle Boost on
- [ ] Navigate to new URL
- [ ] Boost stays enabled
- [ ] Toggle Boost off
- [ ] Navigate to new URL
- [ ] Boost stays disabled

### Boost-07: Boost Error Handling
- [ ] Disable Tauri/GPU support
- [ ] Boost button still visible
- [ ] Toggle may have no effect
- [ ] Falls back to Stream mode

### Boost-08: Renderer Status Indicator
- [ ] Status indicator shows current renderer
- [ ] Color indicates state (blue=loading, green=ready)
- [ ] Updates on renderer change
- [ ] Pulsing animation when loading

## Combined Tests

### Combo-01: Stage with Boost
- [ ] Open Stage with Boost enabled
- [ ] Video plays smoothly in Stage
- [ ] Boost status preserved in Stage
- [ ] Can toggle Boost within Stage

### Combo-02: Rapid Operations
- [ ] Open Stage quickly multiple times
- [ ] Only one Stage opens (anti-sprawl)
- [ ] Toggle Boost rapidly
- [ ] No UI glitches or crashes

### Combo-03: Navigation During Animation
- [ ] Open Stage
- [ ] Quickly click close
- [ ] Animation completes smoothly
- [ ] No stuck states

### Combo-04: Tab Switch with Stage
- [ ] Open Stage in Tab A
- [ ] Switch to Tab B
- [ ] Stage shows Tab B content
- [ ] Switch back to Tab A
- [ ] Stage shows Tab A content

## Performance Tests

### Perf-01: Memory Usage
- [ ] Monitor memory during extended use
- [ ] No memory leaks on close
- [ ] Cleanup on destroy
- [ ] Stable memory footprint

### Perf-02: Animation Frame Rate
- [ ] Stage animations run at 60fps
- [ ] No dropped frames
- [ ] Smooth transitions
- [ ] Consistent timing

### Perf-03: Large Page Load
- [ ] Load complex page in Stage
- [ ] Loading indicator visible
- [ ] Page renders completely
- [ ] Memory stays stable

## Accessibility Tests

### A11y-01: Keyboard Navigation
- [ ] Tab to Stage button
- [ ] Enter opens Stage
- [ ] Tab through Stage controls
- [ ] Escape closes Stage
- [ ] Focus returns correctly

### A11y-02: Screen Reader
- [ ] Stage button has aria-label
- [ ] Loading state announced
- [ ] Error state announced
- [ ] Status changes announced

### A11y-03: Color Contrast
- [ ] Header text is readable
- [ ] Button states are visible
- [ ] Status indicators are visible
- [ ] Error messages are readable

## Cross-Platform Tests

### Platform-01: macOS
- [ ] Stage opens correctly
- [ ] Boost uses WKWebView
- [ ] All animations work
- [ ] Keyboard shortcuts work

### Platform-02: Windows
- [ ] Stage opens correctly
- [ ] Boost uses WebView2
- [ ] All animations work
- [ ] Keyboard shortcuts work

### Platform-03: Linux
- [ ] Stage opens correctly
- [ ] Boost uses WebKitGTK
- [ ] All animations work
- [ ] Keyboard shortcuts work

## Debug Commands

```bash
# Check Stage state
console.log('[StageSlot] Stage opened:', isActive);
console.log('[StageSlot] Size preset:', sizePreset);
console.log('[StageSlot] Current URL:', url);

// Check Boost state
console.log('[GpuRenderer] Renderer type:', rendererType);
console.log('[GpuRenderer] Is boosted:', isBoosted);

// Check performance
console.log('[Metrics] FPS:', fps);
console.log('[Metrics] Latency:', latency);
```

## Known Issues

| Issue | Severity | Workaround |
|-------|----------|------------|
| Rapid toggle may cause flicker | Low | Wait 200ms between toggles |
| Large iframe may lag on resize | Medium | Debounce resize events |
| Audio not supported in Stream | High | Use Boost for audio content |

## Test Sign-off

| Test Category | Tester | Date | Status |
|---------------|--------|------|--------|
| Stage Slot | | | ☐ |
| GPU Boost | | | ☐ |
| Combined Tests | | | ☐ |
| Performance | | | ☐ |
| Accessibility | | | ☐ |
| Cross-Platform | | | ☐ |
