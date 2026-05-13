import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SettingsView } from './SettingsView';
import { MemoryRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import React from 'react';

// Mock Clerk context provider
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useClerk: () => ({}),
  useUser: () => ({ user: { firstName: 'Test', lastName: 'User', emailAddresses: [{ emailAddress: 'test@example.com' }] } }),
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
}));

describe('SettingsView', () => {
  it('renders without crashing', () => {
    render(
      <ClerkProvider publishableKey="pk_test_mock_key">
        <MemoryRouter>
          <SettingsView />
        </MemoryRouter>
      </ClerkProvider>
    );
  });
});
