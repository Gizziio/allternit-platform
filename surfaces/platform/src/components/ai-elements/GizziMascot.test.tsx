import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GizziMascot } from './GizziMascot';

describe('GizziMascot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('reacts to hover and click with pointer-tracked posture and tap feedback', () => {
    render(<GizziMascot emotion="pleased" />);

    const mascot = screen.getByLabelText('Gizzi mascot');
    Object.defineProperty(mascot, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 96,
        height: 96,
        right: 96,
        bottom: 96,
        toJSON: () => ({}),
      }),
    });

    expect(mascot).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-mouth')).toHaveTextContent(':)');
    expect(mascot).toHaveAttribute('data-hovered', 'false');
    expect(mascot).toHaveAttribute('data-pressed', 'false');
    expect(mascot).toHaveAttribute('data-tapped', 'false');

    fireEvent.mouseEnter(mascot);
    fireEvent.mouseMove(mascot, { clientX: 90, clientY: 24 });

    expect(mascot).toHaveAttribute('data-hovered', 'true');
    expect(mascot).toHaveAttribute('data-startled', 'true');
    expect(screen.getByTestId('gizzi-startled-marks')).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-body').getAttribute('style')).toContain('scale(1.13)');
    expect(screen.getByTestId('gizzi-eyes').getAttribute('style')).toContain('translate(');

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(mascot).toHaveAttribute('data-startled', 'false');

    fireEvent.mouseDown(mascot);
    expect(mascot).toHaveAttribute('data-pressed', 'true');
    expect(screen.getByTestId('gizzi-body').getAttribute('style')).toContain('scale(0.88)');

    fireEvent.mouseUp(mascot);
    fireEvent.click(mascot);
    expect(mascot).toHaveAttribute('data-pressed', 'false');
    expect(mascot).toHaveAttribute('data-tapped', 'true');
    expect(screen.getByTestId('gizzi-body').getAttribute('style')).toContain('scale(1.18)');

    act(() => {
      vi.advanceTimersByTime(180);
    });

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.getByTestId('gizzi-mouth').textContent?.includes('D')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mascot).toHaveAttribute('data-tapped', 'false');

    fireEvent.mouseLeave(mascot);
    expect(mascot).toHaveAttribute('data-hovered', 'false');
  });

  it('gets dizzy when hovered in circles and shows stars', () => {
    render(<GizziMascot emotion="curious" />);

    const mascot = screen.getByLabelText('Gizzi mascot');
    Object.defineProperty(mascot, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 96,
        height: 96,
        right: 96,
        bottom: 96,
        toJSON: () => ({}),
      }),
    });

    fireEvent.mouseEnter(mascot);

    const points = [
      [80, 48],
      [70, 26],
      [48, 16],
      [26, 26],
      [16, 48],
      [26, 70],
      [48, 80],
      [70, 70],
      [80, 48],
    ];

    for (const [clientX, clientY] of points) {
      fireEvent.mouseMove(mascot, { clientX, clientY });
    }

    expect(mascot).toHaveAttribute('data-dizzy', 'true');
    expect(screen.getByTestId('gizzi-dizzy-stars')).toBeInTheDocument();
  });

  it('locks on when hovered steadily near the center', () => {
    render(<GizziMascot emotion="focused" />);

    const mascot = screen.getByLabelText('Gizzi mascot');
    Object.defineProperty(mascot, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 96,
        height: 96,
        right: 96,
        bottom: 96,
        toJSON: () => ({}),
      }),
    });

    fireEvent.mouseEnter(mascot);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.mouseMove(mascot, { clientX: 48, clientY: 48 });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(mascot).toHaveAttribute('data-locked-on', 'true');
    expect(screen.getByTestId('gizzi-locked-on-marks')).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-body').getAttribute('style')).toContain('scale(1.07)');
  });

  it('can lock on to nearby UI with external attention cues', () => {
    render(
      <GizziMascot
        emotion="steady"
        attention={{ state: 'locked-on', target: { x: 0.28, y: 0.44 } }}
      />,
    );

    const mascot = screen.getByLabelText('Gizzi mascot');

    expect(mascot).toHaveAttribute('data-external-attention', 'locked-on');
    expect(mascot).toHaveAttribute('data-locked-on', 'true');
    expect(screen.getByTestId('gizzi-locked-on-marks')).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-body').getAttribute('style')).toContain('scale(1.07)');
  });
});
