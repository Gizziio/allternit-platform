# A2R Onboarding Wizard

A React-based onboarding wizard for first-time A2R setup with platform detection, VM image downloads, and initialization.

## Features

- **Platform Detection**: Automatically detects OS (macOS, Linux, Windows) and architecture (x86_64, ARM64)
- **Setup Modes**: Supports both downloading pre-built images and building from source (Linux)
- **Progress Tracking**: Real-time download progress with speed indicators
- **VM Initialization**: Live log streaming during VM startup
- **Keyboard Navigation**: Full keyboard accessibility (Enter, Escape, Arrow keys)
- **VS Code Aesthetic**: Dark theme matching VS Code's design language
- **Responsive**: Works on desktop and smaller screens
- **Accessible**: ARIA labels, focus management, reduced motion support

## Installation

```bash
# Install dependencies
npm install framer-motion lucide-react

# Or with yarn
yarn add framer-motion lucide-react
```

## Quick Start

```tsx
import { OnboardingWizard } from './components/onboarding';

function App() {
  return (
    <OnboardingWizard 
      onComplete={() => {
        console.log('Setup complete!');
        // Navigate to main app
      }}
      onCancel={() => {
        console.log('Setup cancelled');
        // Handle cancellation
      }}
    />
  );
}
```

## Components

### OnboardingWizard

The main wizard container component.

```tsx
interface OnboardingWizardProps {
  /** Callback when wizard is completed */
  onComplete?: () => void;
  /** Callback when wizard is cancelled */
  onCancel?: () => void;
  /** Initial step to start from (0-based index) */
  initialStep?: number;
  /** Additional CSS classes */
  className?: string;
}
```

### CompactOnboardingWizard

A compact version suitable for dialogs or settings pages.

```tsx
<CompactOnboardingWizard 
  onComplete={handleComplete}
  className="max-w-lg"
/>
```

## Steps

The wizard consists of 5 steps:

1. **Welcome** - Introduction to A2R and setup overview
2. **Platform Check** - Detects OS and architecture, offers setup mode selection
3. **Download Images** - Downloads kernel, initrd, and rootfs with progress
4. **Initialize VM** - Starts VM and streams initialization logs
5. **Complete** - Success screen with next steps

## Hooks

### useWizard

Access wizard state and navigation from any step component.

```tsx
import { useWizard } from './components/onboarding';

function CustomStep() {
  const { 
    state,           // Current wizard state
    currentStep,     // Current step index
    goToNext,        // Navigate forward
    goToBack,        // Navigate backward
    canGoBack,       // Boolean
    canGoNext,       // Boolean
    updateDownloadStatus,
    addVMLog,
    setVMStatus,
  } = useWizard();
  
  // Use wizard state...
}
```

### usePlatformDetection

Detect user's platform.

```tsx
import { usePlatformDetection } from './components/onboarding';

const { platform, isChecking, error, detect } = usePlatformDetection({
  autoStart: true,
});
```

### useDownloadManager

Manage VM image downloads.

```tsx
import { useDownloadManager } from './components/onboarding';

const { 
  isDownloading, 
  totalProgress, 
  startDownload, 
  cancelDownload, 
  retry 
} = useDownloadManager({
  version: '1.1.0',
  onComplete: () => console.log('Downloads complete'),
  onError: (err) => console.error('Download failed:', err),
});
```

### useVMInitializer

Initialize the VM with log streaming.

```tsx
import { useVMInitializer } from './components/onboarding';

const { 
  status, 
  logs, 
  isInitializing, 
  initialize, 
  retry 
} = useVMInitializer({
  onComplete: () => console.log('VM ready'),
  onError: (err) => console.error('VM init failed:', err),
});
```

## State Interface

```typescript
interface WizardState {
  platform: {
    type: 'macos' | 'linux' | 'windows';
    arch: 'x86_64' | 'arm64';
    version: string;
    canBuildImages: boolean;
  } | null;
  setupMode: 'download' | 'build' | null;
  downloads: {
    kernel: DownloadFileStatus;
    initrd: DownloadFileStatus;
    rootfs: DownloadFileStatus;
  };
  vmStatus: 'idle' | 'checking' | 'downloading' | 'initializing' | 'running' | 'error' | 'complete';
  vmLogs: string[];
  error: Error | null;
}
```

## Electron Integration

The wizard integrates with Electron through the `window.electron` API:

```typescript
// Platform detection
await window.electron.invoke('platform:get');

// Start downloads
await window.electron.invoke('images:download', {
  version: '1.1.0',
  architecture: 'arm64',
});

// Listen for download progress
window.electron.on('images:progress', (event, data) => {
  updateDownloadProgress(data);
});

// Start VM
await window.electron.invoke('vm:start');

// Listen for VM status
window.electron.on('vm:status', (event, data) => {
  updateVMStatus(data.status);
});

// Listen for VM logs
window.electron.on('vm:log', (event, data) => {
  addVMLog(data.message);
});
```

For development without Electron, the hooks include mock implementations.

## Customization

### Styling

The wizard uses Tailwind CSS classes. Override styles by:

1. Passing a `className` to the wizard
2. Modifying `styles.css`
3. Using Tailwind's `@apply` in your own CSS

### Custom Steps

Create custom steps by implementing the step component interface:

```tsx
interface StepComponentProps {
  onNext: () => void;
  onBack: () => void;
  onFinish?: () => void;
}

function CustomStep({ onNext, onBack }: StepComponentProps) {
  return (
    <Step title="Custom Step" onBack={onBack} onNext={onNext}>
      {/* Your content */}
    </Step>
  );
}
```

### Theming

CSS custom properties are defined in `styles.css`:

```css
:root {
  --wizard-bg-primary: #1e1e1e;
  --wizard-accent-blue: #007acc;
  --wizard-accent-green: #4ec9b0;
  /* ... */
}
```

## Accessibility

- **Keyboard Navigation**: Tab, Enter, Escape, Arrow keys
- **ARIA Labels**: All interactive elements have labels
- **Focus Management**: Visible focus indicators
- **Screen Readers**: Semantic HTML and ARIA attributes
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **High Contrast**: Respects `prefers-contrast`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
