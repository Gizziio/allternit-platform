import React from 'react';
import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsView } from './SettingsView';

// Mock platform auth so the provider context is satisfied without Clerk
vi.mock('@/lib/platform-auth-client', () => ({
  PlatformAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePlatformUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'user-test',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
  usePlatformSignOut: () => async () => {},
  usePlatformHardSignOut: () => async () => {},
  usePlatformSessions: () => ({ sessions: [] }),
  isPlatformAuthDisabled: () => false,
  PlatformSignIn: () => <div>Sign In</div>,
}));

describe('SettingsView', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );
  });
});
