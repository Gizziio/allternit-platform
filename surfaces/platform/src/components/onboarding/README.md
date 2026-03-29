# A2R Platform Onboarding

A Claude Code Desktop-inspired 3-screen onboarding flow with an optional wizard setup.

## Features

### Screen 1: Welcome
- Hero headline with brand colors (Obsidian & Sand)
- Animated Gizzi mascot
- Primary CTA to explore the platform
- Scroll indicator

### Screen 2: Features
- 6 feature cards showcasing platform capabilities:
  - Intelligent Chat
  - Code Mode
  - Browser Automation
  - Swarm Intelligence
  - Terminal Integration
  - Model Flexibility
- User testimonials with category tags
- Skip/Continue actions

### Screen 3: Setup Wizard (Optional)
- **Theme Selection**: Dark, Light, or System
- **Notifications**: Enable/disable notifications and telemetry
- **Workspace**: Preferred modes and default workspace path

## Usage

The onboarding automatically appears for first-time users. The completion state is stored in `localStorage` under the key `a2r-onboarding-storage`.

### Accessing the Store

```typescript
import { 
  useOnboardingStore, 
  useHasCompletedOnboarding,
  useOnboardingPreferences 
} from '@/stores/onboarding-store';

// Check if onboarding is complete
const hasCompleted = useHasCompletedOnboarding();

// Get user preferences
const preferences = useOnboardingPreferences();

// Access store actions
const { 
  skipOnboarding, 
  completeOnboarding,
  resetOnboarding,
  updatePreferences 
} = useOnboardingStore();
```

### Resetting Onboarding

Users can reset onboarding from:
1. **Settings > About** - Click "Reset Onboarding" button
2. **Browser Console** - Run: `localStorage.removeItem('a2r-onboarding-storage')`

## Files

- `src/stores/onboarding-store.ts` - Zustand store with persistence
- `src/components/onboarding/OnboardingFlow.tsx` - Main onboarding component
- `src/components/onboarding/index.ts` - Module exports
- `src/app/page.tsx` - Updated to use ShellApp with onboarding
- `src/shell/ShellApp.tsx` - Integrated onboarding flow
- `src/views/settings/SettingsView.tsx` - Added reset button in About section

## Design System

### Colors
- **Obsidian**: `#0D0B09` - Background
- **Sand**: `#D4B08C` - Accent/CTA
- **Text Primary**: `#FFFFFF` - Headlines
- **Text Secondary**: `rgba(255,255,255,0.6)` - Body text
- **Surface**: `rgba(255,255,255,0.03)` - Cards
- **Border**: `rgba(212,176,140,0.15)` - Subtle borders

### Typography
- Headlines: Georgia, serif
- Body: System UI stack

### Animations
- `fadeInUp`: Content entrance
- `pulse-glow`: CTA button attention
- `float`: Mascot idle animation
- `scroll-indicator`: Bouncing chevron

## Browser Development

To test the onboarding in browser mode:

```bash
pnpm dev
# Open http://localhost:5177
```

The onboarding will appear automatically for first-time users. To see it again, clear localStorage or use the reset button in Settings > About.
