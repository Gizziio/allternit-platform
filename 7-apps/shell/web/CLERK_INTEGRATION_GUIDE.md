# Clerk Authentication + VPS Integration Guide

## Overview

This guide explains how to integrate Clerk authentication and VPS connection management into the A2R Platform Settings view.

## Components Created

### 1. ClerkAuthPanel (`src/components/ClerkAuthPanel.tsx`)
Authentication management component for Settings. Shows:
- Sign in/Sign up options when not authenticated
- User profile and account management when authenticated
- Benefits of signing in

### 2. VPSConnectionsPanel (`src/components/VPSConnectionsPanel.tsx`)
VPS connection management for running AI agents on your infrastructure:
- Add/remove VPS connections
- Test connection health
- Store connections persistently with Zustand

### 3. WelcomeWizard (`src/components/WelcomeWizard.tsx`)
First-time user onboarding overlay:
- 4-step introduction to platform features
- Explains Chat, Code, and VPS modes
- Automatically shows on first app launch
- Dismissible and skippable

## Integration Steps

### Step 1: Add New Section Type to SettingsView

In `../../6-ui/a2r-platform/src/views/settings/SettingsView.tsx`:

```typescript
// Update the SettingsSection type (around line 17)
type SettingsSection = 'general' | 'appearance' | 'models' | 'api-keys' | 'shortcuts' | 'about' | 'signin' | 'vps';
```

### Step 2: Import Components in SettingsView

Add these imports at the top of SettingsView.tsx:

```typescript
import { ClerkAuthPanel } from '../../../7-apps/shell/web/src/components/ClerkAuthPanel';
import { VPSConnectionsPanel } from '../../../7-apps/shell/web/src/components/VPSConnectionsPanel';
```

### Step 3: Add Navigation Items

In the left sidebar navigation (around line 820-850), add:

```typescript
{ id: 'signin', label: 'Sign In', icon: Key, payload: 'signin' },
{ id: 'vps', label: 'VPS Connections', icon: Server, payload: 'vps' },
```

Add these icons to the imports:
```typescript
import { Key, Server } from 'lucide-react';
```

### Step 4: Add renderCase for New Sections

In the `renderContent()` function (around line 700-800), add:

```typescript
case 'signin':
  return <ClerkAuthPanel />;
case 'vps':
  return <VPSConnectionsPanel />;
```

### Step 5: Update Section Icons

In the navigation rendering (around line 840-860), ensure the icons map correctly:

```typescript
const getIconForSection = (section: SettingsSection) => {
  switch (section) {
    case 'signin':
      return <Key style={{ width: '18px', height: '18px' }} />;
    case 'vps':
      return <Server style={{ width: '18px', height: '18px' }} />;
    // ... existing cases
  }
};
```

## Usage Flow

### For New Users:
1. App launches → WelcomeWizard shows automatically
2. User completes or skips wizard
3. User goes to Settings → Sign In section
4. User signs in with Clerk
5. User goes to Settings → VPS Connections
6. User adds their VPS details

### For Returning Users:
1. App launches → No wizard (already completed)
2. User is already signed in (Clerk session persists)
3. VPS connections are loaded from localStorage

## Environment Variables

Ensure `.env.local` exists in `7-apps/shell/web/`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZWFzeS1oYXdrLTUzLmNsZXJrLmFjY291bnRzLmRldiQ
VITE_A2R_GATEWAY_URL=http://127.0.0.1:3000
```

## Clerk Dashboard Configuration

1. Go to https://dashboard.clerk.com
2. Select your application
3. Configure URLs:
   - **Home URL**: `https://platform.airemerge.com`
   - **Sign in URL**: `https://platform.airemerge.com`
   - **After sign-in**: `https://platform.airemerge.com`

## Styling

All components use the existing A2R design system:
- `var(--bg-primary)`, `var(--bg-secondary)` - Background colors
- `var(--text-primary)`, `var(--text-tertiary)` - Text colors
- `var(--accent-chat)` - Accent color
- `var(--border-subtle)`, `var(--border-strong)` - Border colors
- Lucide React icons for consistency

## State Management

- **Clerk**: Handles authentication state
- **Zustand**: Persists VPS connections and welcome wizard state
- **localStorage**: Connections persist across sessions

## Testing

1. Start dev server: `pnpm dev`
2. Verify WelcomeWizard appears on first load
3. Navigate to Settings → Sign In
4. Test Clerk sign-in flow
5. Navigate to Settings → VPS Connections
6. Add a test VPS connection
7. Reload app to verify persistence

## Next Steps

After integration:
1. Build the project: `pnpm build`
2. Deploy to Cloudflare Pages
3. Configure production Clerk keys
4. Update DNS for `platform.airemerge.com`
