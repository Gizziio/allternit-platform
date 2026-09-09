import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { OfficePageChrome } from './OfficePageChrome';

// MemoryRouter keeps its history in memory, not in window.history, so stub
// React Router's `idx` counter (which a real BrowserRouter writes into
// window.history.state) to exercise the Back button's enabled/disabled logic.
function stubHistoryIdx(idx: number): void {
  Object.defineProperty(window.history, 'state', {
    value: { idx },
    configurable: true,
  });
}

function LocationProbe(): React.ReactNode {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderChrome(initialEntries: string[] = ['/docs']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <OfficePageChrome />
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OfficePageChrome', () => {
  it('renders a Back button (disabled at history root) and a Home button', () => {
    stubHistoryIdx(0);
    renderChrome(['/docs']);

    const chrome = screen.getByTestId('office-page-chrome');
    expect(chrome).toBeInTheDocument();

    expect(screen.getByTitle('Back')).toBeDisabled();
    expect(screen.getByTitle('Home')).toBeInTheDocument();
  });

  it('enables Back when there is history to return to', () => {
    stubHistoryIdx(1);
    renderChrome(['/', '/docs']);

    expect(screen.getByTitle('Back')).not.toBeDisabled();
  });

  it('Home navigates to /', () => {
    stubHistoryIdx(1);
    renderChrome(['/docs']);

    fireEvent.click(screen.getByTitle('Home'));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
  });

  it('Back goes through browser history when there is history', () => {
    stubHistoryIdx(1);
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderChrome(['/', '/docs']);

    fireEvent.click(screen.getByTitle('Back'));

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('Back is a no-op at history root', () => {
    stubHistoryIdx(0);
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderChrome(['/docs']);

    fireEvent.click(screen.getByTitle('Back'));

    expect(backSpy).not.toHaveBeenCalled();
  });
});
