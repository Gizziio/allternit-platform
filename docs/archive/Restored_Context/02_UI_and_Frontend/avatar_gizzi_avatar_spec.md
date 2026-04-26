# Gizzi Avatar Integration Specification

**Lane 1 — Avatar Integration Spec**

**Version:** 1.0.0  
**Last Updated:** 2024-01-17  
**Status:** Draft  
**Owner:** Platform Team

---

## 1. Executive Summary

This document specifies the integration of **Gizzi**, an embodied avatar assistant, into the Allternit platform. Gizzi is designed as a pure consumer of ActivityCenter state, providing visual feedback that complements the existing Orb interface without introducing new routing, session logic, or side effects.

**Core Principle:** Gizzi never owns logic. It only reacts to ActivityCenter state changes and VoiceService playback events.

**Key Invariants:**
- Gizzi plugs into existing ActivityCenter state machine (no new invariants)
- Orb ↔ Avatar transitions are deterministic and reversible
- Voice coupling is driven by VoiceService events (no duplicate event handling)
- Avatar can be fully disabled without breaking UX

---

## 2. Embodiment Contract

### 2.1 Pure Consumer Model

Gizzi is a **pure consumer** of the following upstream systems:

```
┌─────────────────────────────────────────────────────────────┐
│                    UPSTREAM SYSTEMS                          │
├─────────────────────────────────────────────────────────────┤
│  ActivityCenter                                              │
│  ├── Provides: ActivityStatus states                         │
│  ├── Contract: getCurrentStatus() polling (100ms interval)  │
│  └── No bidirectional influence                              │
├─────────────────────────────────────────────────────────────┤
│  VoiceService                                                │
│  ├── Provides: Audio playback events (onended)              │
│  ├── Contract: VoiceServiceClient singleton                 │
│  └── No bidirectional influence                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GIZZI AVATAR                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ State → Motion Mapping                              │    │
│  │ Voice Coupling (lip-sync, micro-movements)          │    │
│  │ Orb ↔ Avatar Transitions                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Forbidden Behaviors

Gizzi **MUST NOT** under any circumstances:

1. **Own session logic** — Session creation, management, or termination is handled by BrainContext/ConversationStore
2. **Own routing** — Navigation is handled by App.tsx and conversationStore
3. **Emit events** — Gizzi only consumes; it never dispatches ActivityCenter events
4. **Block UI** — All avatar animations must be non-blocking and interruptible
5. **Cache state** — Gizzi must always read fresh state from ActivityCenter
6. **Duplicate event handling** — Must not re-emit or proxy ActivityCenter events

### 2.3 Guaranteed Invariants

1. ActivityCenter.getCurrentStatus() always returns the authoritative state
2. VoiceService.playAudio() always resolves on audio.onended
3. Orb ↔ Avatar transitions are deterministic (same state → same transition)
4. Avatar can be disabled via feature flag without breaking VoiceOrb

---

## 3. State → Motion Mapping

### 3.1 ActivityCenter States

The ActivityCenter defines eight activity states that Gizzi consumes:

| State | Description | Avatar Response |
|-------|-------------|-----------------|
| `idle` | No active activity | Idle breathing loop |
| `connecting` | Initial connection/integration | Anticipatory pose, subtle movement |
| `reconnecting` | SSE disconnected, attempting reconnect | Restless/alert micro-movements |
| `thinking` | Processing, tool calls | Contemplative pose, eye movement |
| `streaming` | Receiving deltas | Attentive pose, slight forward lean |
| `speaking` | TTS playing | Full animation + lip-sync |
| `done` | Activity complete | Positive acknowledgment pose |
| `error` | Activity failed | Recovery/expression, then idle |

### 3.2 Motion Definitions

Each state maps to specific avatar motions:

#### A. Idle State (idle)
```
Motion:     Breath + Idle Gaze
Frequency:  4-6 breaths/minute
Gaze:       Soft eye movement, brief glances (~2s intervals)
Micro:      Occasional head tilts (~15°)
Priority:   Low (background loop)
```

#### B. Connecting State (connecting)
```
Motion:     Anticipatory Pose
Frequency:  Faster breathing (8-10/min)
Gaze:       Slightly widened eyes, forward attention
Micro:      Subtle weight shifts (left/right)
Priority:   Medium
Transition: 300ms ease-in from idle
```

#### C. Reconnecting State (reconnecting)
```
Motion:     Alert/Restless
Frequency:  Irregular breathing pattern
Gaze:       Quick scanning eye movement
Micro:      Repeated micro-head turns (~5°), fidget
Priority:   High (needs to convey urgency)
Transition: 150ms quick transition from any state
```

#### D. Thinking State (thinking)
```
Motion:     Contemplative
Frequency:  Slow, measured breathing (5-6/min)
Gaze:       Eyes up/right (classic thinking pose)
Micro:      Occasional brow furrow, head tilts
Priority:   Medium-High
Transition: 400ms ease to contemplative pose
```

#### E. Streaming State (streaming)
```
Motion:     Attentive/Engaged
Frequency:  Normal breathing (6-8/min)
Gaze:       Fixed forward attention, slight forward lean
Micro:      Small nods when deltas arrive
Priority:   High
Transition: 200ms quick transition
Trigger:    terminal.delta, chat.delta events
```

#### F. Speaking State (speaking)
```
Motion:     Full Animation + Lip-Sync
Frequency:  Normal breathing (6-8/min) synchronized with speech
Gaze:       Engaged eye contact, blink modulation
Micro:      Lip-sync (viseme matching), eyebrow raises, nods
Priority:   Highest (audio-driven)
Transition: Immediate on speaking state entry
Voice:      Coupled with VoiceService playback
```

#### G. Done State (done)
```
Motion:     Positive Acknowledgment
Frequency:  Single breath cycle (4s inhale, 2s hold, 4s exhale)
Gaze:      Soft smile, warm eye expression
Micro:     Brief nod, subtle shoulder rise
Duration:  2-3 seconds, then fade to idle
Priority:  Medium
Transition: 500ms ease to pose, then 2s transition to idle
```

#### H. Error State (error)
```
Motion:     Recovery Expression
Frequency:  Shallow, quick breathing
Gaze:      Brief downward glance (disappointment), then neutral
Micro:     Single head shake (~10°), return to neutral
Duration:  1-2 seconds, then fade to idle
Priority:  Medium
Transition: 200ms quick transition, 1.5s fade to idle
```

### 3.3 Motion Priority System

When multiple motion requests occur simultaneously, the priority system resolves conflicts:

```
Priority Order (Highest → Lowest):
1. speaking (audio-coupled)    ← Audio always wins
2. reconnecting                 ← Network state is urgent
3. streaming                   ← Data arrival is important
4. error                       ← User needs feedback
5. thinking                    ← Processing state
6. done                        ← Completion feedback
7. connecting                  ← Setup feedback
8. idle                        ← Background only
```

**Rule:** Higher priority always overrides lower priority immediately. No queuing.

---

## 4. Orb ↔ Avatar Transition Rules

### 4.1 Transition Philosophy

The Orb and Avatar represent different modes of expressing the same underlying state:
- **Orb:** Abstract, ambient, continuous feedback
- **Avatar:** Embodied, specific, human-like feedback

Transitions are **deterministic** (same ActivityCenter state always triggers same transition) and **reversible** (user can toggle between modes at any time without state loss).

### 4.2 Transition Matrix

| From State | To Orb | To Avatar | Trigger | Timing |
|------------|--------|-----------|---------|--------|
| idle | Orb visible | Avatar hidden | Feature flag OFF | Immediate |
| idle | Orb fades | Avatar fades in | Feature flag ON | 300ms fade each |
| speaking | Orb subtle pulse | Avatar full animation | State change | 150ms |
| done | Orb expands briefly | Avatar acknowledgment | State change | 200ms |
| error | Orb turns red | Avatar recovery | State change | 100ms |

### 4.3 Transition Timing Specification

```
TRANSITION: idle ↔ avatar_enabled
├── Orb Fade Out:     300ms ease-out
├── Avatar Fade In:   300ms ease-in
├── Gap:              50ms (both hidden)
└── Total Duration:   650ms

TRANSITION: speaking ↔ speaking
├── Orb:              Continuous subtle pulse
├── Avatar:           Immediate lip-sync start
├── Sync Tolerance:   ±50ms (audio-visual sync)
└── Priority:         Avatar motion takes precedence

TRANSITION: any_state → error
├── Orb Color:        Immediate red
├── Avatar:           100ms transition to recovery pose
└── Visual Feedback:  Both show error simultaneously
```

### 4.4 ID-Guard for Zero Re-Trigger Risk

All transitions use an ID-guard pattern to prevent duplicate transitions:

```typescript
// Example pattern (not actual code - see implementation section)
let lastTransitionId: string | null = null;

function requestTransition(targetMode: 'orb' | 'avatar') {
  const transitionId = generateTransitionId(); // monotonic counter + timestamp
  
  if (transitionId <= lastTransitionId) {
    return; // Skip - duplicate/out-of-order
  }
  
  lastTransitionId = transitionId;
  executeTransition(targetMode);
}
```

**ID Generation Strategy:**
- Orb mode: `orb_${activityId}`
- Avatar mode: `avatar_${activityId}`
- Only the latest ID for each mode is honored

### 4.5 State Persistence During Toggle

When user toggles between Orb and Avatar mid-activity:

1. **Orb → Avatar:** Avatar immediately reflects current ActivityCenter state (no reset)
2. **Avatar → Orb:** Orb immediately reflects current ActivityCenter state (no reset)
3. **Toggle during speaking:** Lip-sync continues seamlessly; Orb resumes subtle pulse

---

## 5. Voice Coupling

### 5.1 Event Flow

```
VoiceService.playAudio(url)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              VOICE COUPLING PIPELINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. AUDIO START                                             │
│     ├── Trigger: playAudio() called                         │
│     ├── Action: → Avatar "speaking" pose                    │
│     ├── Timing: ≤50ms from audio.play()                     │
│     └── Guard: Only if ActivityCenter.status === 'speaking' │
│                                                             │
│  2. LIP-SYNC GENERATION                                     │
│     ├── Source: Audio amplitude analysis                    │
│     ├── Visemes: 8-core viseme mapping                      │
│     ├── Update:  60fps (every 16ms)                         │
│     └── Fallback: If no audio data, return to idle breathing│
│                                                             │
│  3. AUDIO END                                               │
│     ├── Trigger: audio.onended event                        │
│     ├── Action: → ActivityCenter.onSpeakingEnd()            │
│     └── Avatar: → "done" pose (2s) → idle                   │
│                                                             │
│  4. INTERRUPTION (user stop)                                │
│     ├── Trigger: voiceService.stopAudio()                   │
│     ├── Action: → ActivityCenter.cancelActivity()           │
│     └── Avatar: → idle immediately                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Lip-Sync Implementation

#### Viseme Mapping (8-core set)

| Viseme | Description | Example Phonemes |
|--------|-------------|------------------|
| `aa` | Open mouth | a, o, ow |
| `ee` | Wide smile | e, ay |
| `ih` | Slightly open | i, ih, y |
| `oh` | Rounded lips | oo, u, w |
| `oo` | Small round | oo (as in loop) |
| `mm` | Closed lips | m, b, p |
| `ff` | Teeth on lip | f, v |
| `ss` | Teeth together | s, z, th, d, t, n, l |

#### Amplitude-to-Viseme Algorithm

```typescript
// Conceptual algorithm (actual implementation may vary)
function getVisemeFromAmplitude(amplitude: number): Viseme {
  // Normalize amplitude 0-1
  const normalized = Math.max(0, Math.min(1, amplitude));
  
  // Map amplitude to mouth openness (0 = closed, 1 = fully open)
  const openness = normalized * 0.9; // Max 90% open
  
  // Determine viseme based on openness curve
  if (openness < 0.1) return 'mm';      // Closed
  if (openness < 0.3) return 'ff';      // Slight open
  if (openness < 0.5) return 'ss';      // Moderate
  if (openness < 0.7) return 'ih';      // More open
  if (openness < 0.85) return 'aa';     // Open
  return 'oh';                          // Fully open
}
```

### 5.3 Zero Re-Trigger Guarantee

The system guarantees no duplicate audio-visual sync events:

1. **Single Source of Truth:** VoiceService singleton is the only place audio is managed
2. **ID-Guard on Transitions:** Each speaking session gets unique ID; only latest honored
3. **ActivityCenter Coupling:** `speaking` state → `done` transition is atomic
4. **Cleanup on Unmount:** React cleanup functions ensure no orphaned animations

```typescript
// Protection pattern
const sessionIdRef = useRef<string | null>(null);

function startSpeaking(audioUrl: string) {
  const id = `speaking_${Date.now()}_${Math.random()}`;
  sessionIdRef.current = id;
  
  voiceService.playAudio(audioUrl).then(() => {
    if (sessionIdRef.current === id) {
      // Only process if this is still the active session
      activityCenter.onSpeakingEnd();
    }
  });
}
```

---

## 6. Rendering Strategy (Incremental)

### 6.1 Phase A: 2D/Canvas or Rive (Lowest Risk)

**Timeline:** Sprint 1-2  
**Risk Level:** Low  
**Deliverable:** Functional avatar with basic state animations

**Technology Choices:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Canvas 2D | Simple, no deps | Limited expressiveness | For simple avatar |
| Rive | Vector, state machines, web-native | Learning curve | **Recommended** for Gizzi |
| SVG + CSS | No runtime, easy to style | Complex animations hard | Fallback |

**Why Rive?**
- Native state machine support (matches ActivityCenter states)
- WebAssembly-based, performant
- Can export to WebGL later
- Active maintenance, good documentation

**Phase A Deliverables:**
- [ ] Rive file with state machine (idle, thinking, speaking, done, error)
- [ ] React component wrapping Rive runtime
- [ ] ActivityCenter → Rive state mapping
- [ ] Lip-sync hook (amplitude analysis → viseme)
- [ ] Unit tests for state transitions

### 6.2 Phase B: WebGL/Three.js (Optional)

**Timeline:** Sprint 3-4  
**Risk Level:** Medium  
**Purpose:** Enhanced expressiveness, better performance for complex scenes

**Trigger Criteria (Go/No-Go at end of Phase A):**
- [ ] Phase A complete with 100% test coverage
- [ ] No critical bugs in state transitions
- [ ] Performance ≥ 30fps on target devices
- [ ] Design team provides 3D assets

**Phase B Add-ons:**
- [ ] Three.js renderer integration
- [ ] 3D model with skeletal animation
- [ ] Advanced lighting and shadows
- [ ] Post-processing effects (bloom, depth of field)

### 6.3 Phase C: Human-Grade Avatar (Future)

**Timeline:** Future roadmap  
**Risk Level:** High (requires external partnership)  
**Purpose:** Photo-realistic avatar for premium tier

**Compatibility Requirements (Must be satisfied in Phases A-B):):**
- [ ] All state transitions documented
- [ ] Lip-sync API abstracted (can swap amplitude→viseme with other providers)
- [ ] Animation system decoupled from rendering
- [ ] Performance profiling infrastructure in place

---

## 7. Non-Negotiables

### 7.1 Avatar Never Blocks UI

**Enforcement:**
- All avatar animations run in requestAnimationFrame with early exit on main thread contention
- No `await` in render paths
- Animation frames yield if frame time exceeds 16ms (60fps target)
- ActivityCenter polling interval is 100ms (not blocking)

**Fallback:** If avatar animation lags, system gracefully degrades:
1. Skip micro-movements
2. Reduce animation frame rate to 15fps
3. If still lagging → hide avatar, show placeholder

### 7.2 Avatar Never Owns Logic

**Enforcement:**
- Avatar component receives `status` prop from parent
- Avatar component has no imports from BrainContext, ConversationStore
- Avatar component has no side effects (only refs for animation)
- All state comes from ActivityCenter singleton

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    PARENT COMPONENT                          │
│  (owns ActivityCenter subscription)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  useEffect(() => {                                          │
│    const interval = setInterval(() => {                     │
│      const status = activityCenter.getCurrentStatus();      │
│      setAvatarStatus(status);                               │
│    }, 100);                                                 │
│    return () => clearInterval(interval);                    │
│  }, []);                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (prop: status)
┌─────────────────────────────────────────────────────────────┐
│                    AVATAR COMPONENT                          │
│  - Pure React component                                     │
│  - No state management                                      │
│  - No API calls                                             │
│  - Only animation control                                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Avatar Can Be Fully Disabled

**Feature Flag Location:** `window.__FEATURE_FLAGS?.enableAvatar` (configurable)

**Disabled Behavior:**
- Avatar component renders `null`
- Orb component unchanged
- ActivityCenter subscription continues (no orphaned intervals)
- All other UX continues normally

**Implementation:**
```typescript
// In parent component
const avatarEnabled = window.__FEATURE_FLAGS?.enableAvatar ?? false;

return (
  <>
    <VoiceOrb {...orbProps} />
    {avatarEnabled && <GizziAvatar status={status} />}
  </>
);
```

---

## 8. State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ACTIVITYCENTER → AVATAR STATE MACHINE                 │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────────────────────────┐
                    │              IDLE STATE                 │
                    │                                        │
                    │  ┌──────────────────────────────────┐  │
                    │  │ Breath: 4-6/min                  │  │
                    │  │ Gaze: Soft, occasional glances    │  │
                    │  │ Micro: Head tilts (~15°)         │  │
                    │  │ Priority: LOW                    │  │
                    │  └──────────────────────────────────┘  │
                    └────────────────┬───────────────────────┘
                                     │
                    ┌────────────────┼───────────────────────┐
                    │                │                       │
                    ▼                ▼                       ▼
           ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
           │  CONNECTING    │ │  RECONNECTING  │ │    ERROR       │
           │                │ │                │ │                │
           │  Anticipatory  │ │    Alert/      │ │   Recovery     │
           │  Pose          │ │    Restless    │ │   Expression   │
           │                │ │                │ │                │
           │ Breath: 8-10/min│ │ Breath: Irreg. │ │ Breath: Shallow│
           │ Gaze: Forward   │ │ Gaze: Scanning │ │ Gaze: Down     │
           │ Transition:300ms│ │ Transition:150ms│ │ Transition:100ms│
           │ Priority: MED   │ │ Priority: HIGH │ │ Priority: MED  │
           └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
                   │                 │                 │
                   │    ┌────────────┼────────────┐    │
                   │    │            │            │    │
                   ▼    ▼            │            ▼    ▼
           ┌────────────────┐       │    ┌────────────────┐
           │   THINKING     │       │    │    DONE        │
           │                │       │    │                │
           │  Contemplative │       │    │   Positive     │
           │  Pose          │       │    │   Acknowledge  │
           │                │       │    │                │
           │ Breath: 5-6/min│       │    │ Breath: Cycle  │
           │ Gaze: Up/Right │       │    │ Gaze: Warm     │
           │ Transition:400ms│      │    │ Duration: 2-3s │
           │ Priority: MED-HI│      │    │ Transition:500ms│
           └───────┬────────┘       │    └───────┬────────┘
                   │                │            │
                   │    ┌───────────┴────────┐   │
                   │    │                    │   │
                   ▼    ▼                    ▼   ▼
           ┌──────────────────────────────────────────┐
           │              STREAMING                   │
           │                                          │
           │            Attentive/Engaged             │
           │                                          │
           │         Breath: 6-8/min (normal)         │
           │         Gaze: Forward, slight lean       │
           │         Micro: Nods on delta             │
           │         Priority: HIGH                   │
           │         Transition: 200ms quick          │
           └────────────────────┬─────────────────────┘
                                │
                                │ chat.delta / terminal.delta
                                ▼
           ┌──────────────────────────────────────────┐
           │              SPEAKING                    │
           │                                          │
           │        Full Animation + LIP-SYNC         │
           │                                          │
           │      Breath: 6-8/min (speech-synced)     │
           │      Gaze: Eye contact, blink mod.       │
           │      Micro: Lip-sync, brow raises        │
           │      Priority: HIGHEST (audio-coupled)   │
           │      Transition: Immediate               │
           │                                          │
           │              ┌─────────┐                 │
           │              │ AUDIO   │                 │
           │              │ COUPLING│                 │
           │              │         │                 │
           │              │ playAudio()              │
           │              │ → onended                │
           │              └────┬────┘                 │
           │                   │                      │
           │                   ▼                      │
           │         ┌─────────────────────┐          │
           │         │  activityCenter.    │          │
           │         │  onSpeakingEnd()    │          │
           │         └──────────┬──────────┘          │
           │                    │                      │
           └────────────────────┼──────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │         DONE          │
                    │                       │
                    │   Positive pose (2-3s)│
                    │   → Fade to idle      │
                    └───────────────────────┘
```

### 8.1 Transition Timing Summary

| From State | To State | Trigger | Duration | Ease |
|------------|----------|---------|----------|------|
| idle | connecting | activity start | 300ms | ease-in |
| idle | avatar_enabled | feature flag | 300ms + 50ms + 300ms | ease-out + ease-in |
| any → reconnecting | network disconnect | 150ms | quick |
| any → thinking | tool call start | 400ms | ease |
| thinking → streaming | delta received | 200ms | quick |
| streaming → speaking | audio play | 0ms | immediate |
| speaking → done | audio end | 200ms + 2000ms | ease + fade |
| any → error | error event | 100ms | quick |
| error → idle | auto after 2s | 1500ms | fade |
| done → idle | timeout | 2000ms | fade |

---

## 9. Implementation Checklist

### 9.1 Files to Create/Modify

#### New Files (Phase A)

| File Path | Purpose | Status |
|-----------|---------|--------|
| `docs/avatar/gizzi_avatar_spec.md` | This specification | ✅ Created |
| `apps/shell/src/components/avatar/GizziAvatar.tsx` | Main avatar component | ⬜ |
| `apps/shell/src/components/avatar/avatar.css` | Avatar styles | ⬜ |
| `apps/shell/src/components/avatar/useAvatarState.ts` | State mapping hook | ⬜ |
| `apps/shell/src/components/avatar/useLipSync.ts` | Lip-sync hook | ⬜ |
| `apps/shell/src/components/avatar/avatar.stories.tsx` | Storybook stories | ⬜ |
| `apps/shell/src/components/avatar/avatar.test.tsx` | Unit tests | ⬜ |
| `docs/avatar/rive_state_machine.md` | Rive state machine guide | ⬜ |

#### Modified Files

| File Path | Change | Status |
|-----------|--------|--------|
| `apps/shell/src/App.tsx` | Add GizziAvatar to render tree | ⬜ |
| `apps/shell/src/runtime/ActivityCenter.ts` | Add subscriber pattern (optional enhancement) | ⬜ |
| `apps/shell/src/runtime/VoiceService.ts` | Export audio element reference for lip-sync | ⬜ |
| `apps/shell/src/components/VoiceOrb.tsx` | Add toggle for Orb/Avatar mode | ⬜ |

#### Configuration Files

| File Path | Change | Status |
|-----------|--------|--------|
| `apps/shell/src/config/featureFlags.ts` | Add `enableAvatar` flag | ⬜ |
| `apps/shell/vite.config.ts` | Add Rive runtime to build | ⬜ |

### 9.2 Hooks to Implement

#### useAvatarState

```typescript
// Signature
function useAvatarState(): {
  status: ActivityStatus;
  isAvatarMode: boolean;
  transitionMode: 'orb' | 'avatar';
}

// Behavior
// - Polls activityCenter.getCurrentStatus() every 100ms
// - Returns current status and avatar mode state
// - Handles Orb ↔ Avatar transitions with ID-guards
```

#### useLipSync

```typescript
// Signature
function useLipSync(audioElement: HTMLAudioElement | null): {
  viseme: Viseme;
  amplitude: number;
  isSpeaking: boolean;
}

// Behavior
// - Analyzes audio amplitude at 60fps
// - Maps amplitude to 8-core viseme set
// - Returns viseme + amplitude for animation
// - Cleanup on unmount
```

#### useAvatarAnimation

```typescript
// Signature
function useAvatarAnimation(
  status: ActivityStatus,
  options?: {
    lipSync?: Viseme;
    transitionDuration?: number;
  }
): {
  pose: string;
  microMovements: MicroMovement[];
  gaze: GazeTarget;
}

// Behavior
// - Maps ActivityStatus to pose name
// - Generates micro-movement instructions
// - Handles transition animations
// - Manages idle loop when status === 'idle'
```

### 9.3 No-Go Zones

**Gizzi MUST NOT touch these files/systems:**

| File/System | Reason |
|-------------|--------|
| `apps/shell/src/runtime/BrainContext.tsx` | Brain logic is separate from avatar |
| `apps/shell/src/runtime/ConversationStore.ts` | Session logic not owned by avatar |
| `apps/cli/src/commands/daemon.rs` | CLI orchestration not affected |
| `services/kernel/` | Rust backend untouched |
| `services/ai/voice-service/` | VoiceService is consumer-only |
| `apps/shell/src/components/ChatSessions.tsx` | Chat logic unchanged |
| `apps/shell/src/components/BrainManagerWidget.tsx` | Brain management unchanged |

**Exception:** May import types from these files, but never call methods or modify state.

### 9.4 Testing Requirements

#### Unit Tests (Jest/Vitest)

| Test | Coverage Target |
|------|-----------------|
| State → motion mapping accuracy | 100% |
| Transition timing within tolerance | 100% |
| ID-guard prevents re-triggers | 100% |
| Feature flag disable works | 100% |
| Lip-sync amplitude → viseme mapping | 95% |

#### Integration Tests

| Test | Target |
|------|--------|
| Avatar shows speaking state during TTS | Manual |
| Avatar transitions to done after audio | Manual |
| Toggle Orb ↔ Avatar mid-activity | Manual |
| Error state recovery animation | Manual |

#### Performance Tests

| Metric | Target |
|--------|--------|
| Frame rate during speaking | ≥ 30fps |
| Memory growth over 1hr session | < 10MB |
| Time to first animation frame | < 100ms |
| Audio-visual sync tolerance | ±50ms |

---

## 10. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| ActivityCenter | Singleton managing activity lifecycle and state |
| ActivityStatus | Union of 8 states: idle, connecting, reconnecting, thinking, streaming, speaking, done, error |
| Avatar | Gizzi, the embodied assistant visualization |
| DPR | Device Pixel Ratio (for scaling calculations) |
| Lip-sync | Visual animation synchronized to audio |
| Orb | VoiceOrb, the existing abstract visualization |
| Viseme | Visual equivalent of a phoneme (speech gesture) |
| ID-Guard | Pattern preventing duplicate/out-of-order events |

### Appendix B: Reference Implementation

**ActivityCenter Polling Pattern (from ActivityPill.tsx):**

```typescript
React.useEffect(() => {
  const interval = setInterval(() => {
    const currentStatus = activityCenter.getCurrentStatus();
    setStatus(currentStatus);
  }, 100); // 100ms polling interval

  return () => clearInterval(interval);
}, []);
```

**VoiceService Audio Handling (from VoiceService.ts):**

```typescript
async playAudio(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.audioElement = new Audio(url);
    
    this.audioElement.onended = () => {
      this.audioElement = null;
      resolve();
    };
    
    this.audioElement.onerror = () => {
      this.audioElement = null;
      reject(new Error('Audio playback failed'));
    };
    
    this.audioElement.play().catch(reject);
  });
}
```

### Appendix C: Related Documents

| Document | Location |
|----------|----------|
| ActivityCenter Source | `apps/shell/src/runtime/ActivityCenter.ts` |
| VoiceService Source | `apps/shell/src/runtime/VoiceService.ts` |
| VoiceOrb Source | `apps/shell/src/components/VoiceOrb.tsx` |
| ActivityPill Pattern | `apps/shell/src/components/ActivityPill.tsx` |

### Appendix D: Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2024-01-17 | Platform Team | Initial draft |

---

**End of Specification**
