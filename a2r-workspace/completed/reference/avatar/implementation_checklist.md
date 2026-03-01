# Gizzi Avatar Implementation Checklist

**Lane 1 — Avatar Integration Implementation**

**Version:** 1.0.0  
**Last Updated:** 2024-01-17  
**Related Spec:** `docs/avatar/gizzi_avatar_spec.md`

---

## Quick Reference

| Phase | Deliverables | Effort |
|-------|--------------|--------|
| Phase A | Rive avatar + state mapping + lip-sync | 2 sprints |
| Phase B | Three.js upgrade (optional) | 2 sprints |
| Phase C | Human-grade avatar (future) | TBD |

---

## Phase A: 2D/Canvas or Rive Implementation

### Phase A.1: Project Setup

- [ ] **Create avatar component directory**
  ```bash
  mkdir -p apps/shell/src/components/avatar
  ```

- [ ] **Add Rive runtime dependency**
  ```bash
  cd apps/shell && npm install @rive-app/react-canvas
  ```

- [ ] **Configure feature flag**
  - Create `apps/shell/src/config/featureFlags.ts`
  - Add `enableAvatar: boolean` (default: false)

- [ ] **Update vite.config.ts**
  - Ensure Rive WASM is properly handled

### Phase A.2: Avatar Component

- [ ] **Create GizziAvatar.tsx**
  - [ ] Import useAvatarState hook
  - [ ] Import useLipSync hook
  - [ ] Render Rive component with state machine
  - [ ] Handle feature flag (render null if disabled)
  - [ ] Export as default

- [ ] **Create useAvatarState.ts**
  - [ ] Poll activityCenter.getCurrentStatus() every 100ms
  - [ ] Track avatar mode (orb/avatar toggle)
  - [ ] Implement ID-guard for transitions
  - [ ] Return: `{ status, isAvatarMode, transitionMode }`

- [ ] **Create useLipSync.ts**
  - [ ] Accept audioElement ref
  - [ ] Analyze amplitude at 60fps
  - [ ] Map to 8-core visemes
  - [ ] Return: `{ viseme, amplitude, isSpeaking }`

### Phase A.3: Rive State Machine

- [ ] **Design state machine in Rive Editor**
  - States: idle, connecting, reconnecting, thinking, streaming, speaking, done, error
  - Transitions: All ActivityCenter state transitions
  - Input: `status` (string enum)

- [ ] **Export Rive file**
  - Save as `apps/shell/src/components/avatar/gizzi.riv`
  - Ensure WASM export enabled

- [ ] **Create state mapping constant**
  ```typescript
  // avatarStateMapping.ts
  export const STATE_MAPPING: Record<ActivityStatus, string> = {
    idle: 'idle',
    connecting: 'connecting',
    reconnecting: 'reconnecting',
    thinking: 'thinking',
    streaming: 'streaming',
    speaking: 'speaking',
    done: 'done',
    error: 'error',
  };
  ```

### Phase A.4: Voice Coupling Integration

- [ ] **Extend VoiceService**
  - [ ] Export audioElement reference (read-only)
  - [ ] Add `onPlaybackStart` callback support
  - [ ] Add `onPlaybackEnd` callback support

- [ ] **Wire lip-sync to audio**
  - [ ] Pass audioElement to useLipSync hook
  - [ ] Update viseme on amplitude changes
  - [ ] Handle audio end (transition to done)

- [ ] **Handle interruption**
  - [ ] Stop lip-sync on voiceService.stopAudio()
  - [ ] Transition to idle immediately

### Phase A.5: Orb ↔ Avatar Toggle

- [ ] **Add toggle UI to VoiceOrb**
  - [ ] Add avatar toggle button
  - [ ] Handle click → emit toggle event
  - [ ] Visual indicator of current mode

- [ ] **Implement transition logic**
  - [ ] Orb fade out (300ms)
  - [ ] Avatar fade in (300ms)
  - [ ] Gap handling (50ms)
  - [ ] ID-guard for toggle spam

### Phase A.6: Styling

- [ ] **Create avatar.css**
  - [ ] Avatar container positioning
  - [ ] Fade transitions
  - [ ] Z-index management
  - [ ] Responsive sizing

- [ ] **Define CSS variables**
  ```css
  :root {
    --avatar-size: 200px;
    --avatar-z-index: 100;
    --avatar-fade-duration: 300ms;
  }
  ```

### Phase A.7: Testing

- [ ] **Unit tests (useAvatarState)**
  - [ ] Polling interval is 100ms
  - [ ] Status updates on activity change
  - [ ] ID-guard blocks duplicate transitions

- [ ] **Unit tests (useLipSync)**
  - [ ] Amplitude analysis at 60fps
  - [ ] Correct viseme mapping
  - [ ] Cleanup on unmount

- [ ] **Integration tests**
  - [ ] Speaking state triggers lip-sync
  - [ ] Done state after audio end
  - [ ] Error state animation
  - [ ] Toggle Orb ↔ Avatar mid-activity

- [ ] **Performance tests**
  - [ ] Frame rate ≥ 30fps during speaking
  - [ ] Memory growth < 10MB over 1hr
  - [ ] Audio-visual sync within ±50ms

### Phase A.8: Documentation

- [ ] **Create Storybook stories**
  - [ ] Avatar in each state
  - [ ] Orb ↔ Avatar toggle
  - [ ] Error recovery animation

- [ ] **Update runbooks**
  - [ ] How to enable avatar (feature flag)
  - [ ] Troubleshooting guide

---

## Phase B: WebGL/Three.js (Optional)

### Phase B.1: Go/No-Go Decision Criteria

- [ ] Phase A 100% complete
- [ ] No critical bugs in state transitions
- [ ] Performance ≥ 30fps on target devices
- [ ] Design team provides 3D assets

### Phase B.2: Three.js Integration

- [ ] **Add Three.js dependency**
  ```bash
  cd apps/shell && npm install three @types/three
  ```

- [ ] **Create Three.js renderer**
  - [ ] Scene setup
  - [ ] Camera configuration
  - [ ] Lighting setup
  - [ ] Shadow rendering

- [ ] **Import 3D model**
  - [ ] GLTF/GLB format
  - [ ] Skeletal animation support
  - [ ] Blend shape support (for lip-sync)

- [ ] **Map Rive states to 3D animations**
  - [ ] Create animation clips for each state
  - [ ] Handle transitions between clips
  - [ ] Blend shapes for lip-sync

### Phase B.3: Advanced Features

- [ ] **Post-processing effects**
  - [ ] Bloom for glow effects
  - [ ] Depth of field for focus
  - [ ] Ambient occlusion

- [ ] **Enhanced lighting**
  - [ ] Dynamic lighting based on scene
  - [ ] Rim lighting for avatar
  - [ ] Environment mapping

### Phase B.4: Performance Optimization

- [ ] **Level of detail (LOD)**
  - [ ] Reduce geometry at distance
  - [ ] Simplify animations when off-screen

- [ ] **Culling**
  - [ ] Frustum culling
  - [ ] Occlusion culling

---

## Phase C: Human-Grade Avatar (Future)

**Trigger:** Business decision, external partnership

### Compatibility Requirements (Must be satisfied in Phases A-B)

- [ ] State transitions documented
- [ ] Lip-sync API abstracted (pluggable provider)
- [ ] Animation system decoupled from rendering
- [ ] Performance profiling infrastructure
- [ ] A/B testing framework ready

---

## File Inventory

### New Files to Create

```
apps/shell/src/components/avatar/
├── GizziAvatar.tsx              # Main avatar component
├── avatar.css                   # Avatar styles
├── useAvatarState.ts            # State mapping hook
├── useLipSync.ts                # Lip-sync hook
├── useAvatarAnimation.ts        # Animation control hook
├── avatarStateMapping.ts        # State → Rive mapping
├── gizzi.riv                    # Rive state machine file
├── avatar.stories.tsx           # Storybook stories
├── avatar.test.tsx              # Unit tests
└── index.ts                     # Exports

apps/shell/src/config/
└── featureFlags.ts              # Feature flags (add enableAvatar)

docs/avatar/
├── gizzi_avatar_spec.md         # This spec
├── implementation_checklist.md  # This file
└── rive_state_machine.md        # Rive state machine guide
```

### Files to Modify

```
apps/shell/src/App.tsx                    # Add GizziAvatar to render tree
apps/shell/src/components/VoiceOrb.tsx    # Add toggle button
apps/shell/src/runtime/VoiceService.ts    # Export audio element ref
apps/shell/vite.config.ts                 # Rive WASM configuration
```

### Files NOT to Modify (No-Go Zones)

```
apps/shell/src/runtime/BrainContext.tsx
apps/shell/src/runtime/ConversationStore.ts
apps/cli/src/commands/daemon.rs
services/kernel/
4-services/ai/voice-service/
apps/shell/src/components/ChatSessions.tsx
apps/shell/src/components/BrainManagerWidget.tsx
```

---

## Testing Checklist

### Unit Tests Required

| Hook/Component | Tests | Coverage |
|----------------|-------|----------|
| useAvatarState | Status polling, ID-guard, mode toggle | 100% |
| useLipSync | Amplitude analysis, viseme mapping, cleanup | 100% |
| useAvatarAnimation | State→pose mapping, transition handling | 100% |
| GizziAvatar | Feature flag, render null, prop passing | 100% |

### Integration Tests Required

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Speaking state | 1. Start activity 2. Trigger TTS | Avatar shows lip-sync |
| Audio end | 1. Complete speaking 2. Wait | Avatar → done → idle |
| Toggle mode | 1. Click toggle 2. Observe | Smooth fade Orb ↔ Avatar |
| Error state | 1. Trigger error | Avatar shows recovery |
| Reconnecting | 1. Disconnect network | Avatar shows alert |

### Performance Tests Required

| Metric | Target | Test Method |
|--------|--------|-------------|
| Frame rate | ≥ 30fps | Chrome DevTools FPS meter |
| Memory | < 10MB/hr growth | Memory profiler |
| Sync tolerance | ±50ms | Audio-visual sync test |
| First frame | < 100ms | Performance.now() measurement |

---

## Rollout Plan

### Sprint 1

- [ ] Project setup
- [ ] Feature flag configuration
- [ ] Basic avatar component structure
- [ ] useAvatarState hook

### Sprint 2

- [ ] Rive state machine creation
- [ ] useLipSync hook
- [ ] Voice coupling integration
- [ ] Orb ↔ Avatar toggle
- [ ] Testing

### Post-Sprint 2

- [ ] Code review
- [ ] Performance optimization
- [ ] Documentation
- [ ] Feature flag enabled for internal testing

---

## Success Criteria

### Functional

- [ ] Avatar shows correct animation for each ActivityCenter state
- [ ] Lip-sync synchronized with audio (±50ms)
- [ ] Toggle between Orb and Avatar works seamlessly
- [ ] Error state animation is visible
- [ ] Avatar can be disabled without breaking UX

### Non-Functional

- [ ] Frame rate ≥ 30fps during speaking
- [ ] Memory growth < 10MB over 1 hour
- [ ] 100% unit test coverage on new code
- [ ] No critical bugs

### Process

- [ ] All files documented
- [ ] Storybook stories created
- [ ] Runbook updated
- [ ] Code reviewed by 2+ engineers

---

**End of Checklist**
