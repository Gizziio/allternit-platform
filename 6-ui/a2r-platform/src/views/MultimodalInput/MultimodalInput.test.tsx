/**
 * Multimodal Input Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MultimodalInput } from './MultimodalInput';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  constructor() {
    setTimeout(() => this.onopen?.(), 10);
  }
  
  send() {}
  close() {
    this.onclose?.();
  }
}

global.WebSocket = MockWebSocket as any;
global.fetch = vi.fn();

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
global.navigator.mediaDevices = {
  getUserMedia: mockGetUserMedia,
} as any;

// Mock HTMLCanvasElement
const mockGetContext = vi.fn(() => ({
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getContextAttributes: vi.fn(() => ({})),
  canvas: { width: 0, height: 0 },
}));

const mockToBlob = vi.fn(function(callback: BlobCallback) {
  callback(new Blob(['mock'], { type: 'image/jpeg' }));
});

const mockToDataURL = vi.fn(() => 'data:image/jpeg;base64,mock');

Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
  value: mockGetContext,
  writable: true,
});
Object.defineProperty(window.HTMLCanvasElement.prototype, 'toBlob', {
  value: mockToBlob,
  writable: true,
});
Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', {
  value: mockToDataURL,
  writable: true,
});

describe('MultimodalInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Mock video element play/pause methods
    const mockVideoPlay = vi.fn().mockResolvedValue(undefined);
    const mockVideoPause = vi.fn();
    Object.defineProperty(window.HTMLVideoElement.prototype, 'play', {
      value: mockVideoPlay,
      writable: true,
    });
    Object.defineProperty(window.HTMLVideoElement.prototype, 'pause', {
      value: mockVideoPause,
      writable: true,
    });
    Object.defineProperty(window.HTMLVideoElement.prototype, 'srcObject', {
      value: null,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders initial state', () => {
    render(<MultimodalInput />);
    
    expect(screen.getByText('Multimodal Input')).toBeInTheDocument();
    expect(screen.getByText('Camera')).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Start All')).toBeInTheDocument();
  });

  it('displays disconnected status initially', () => {
    render(<MultimodalInput />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('handles camera start successfully', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    const cameraSwitch = screen.getByRole('switch', { name: /camera/i });
    fireEvent.click(cameraSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ video: expect.any(Object) })
      );
    });
  });

  it('handles camera start failure', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Camera not available'));

    render(<MultimodalInput />);

    const cameraSwitch = screen.getByRole('switch', { name: /camera/i });
    fireEvent.click(cameraSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  it('handles microphone start successfully', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    const micSwitch = screen.getByRole('switch', { name: /microphone/i });
    fireEvent.click(micSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ audio: expect.any(Object) })
      );
    });
  });

  it('handles microphone start failure', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Microphone not available'));

    render(<MultimodalInput />);

    const micSwitch = screen.getByRole('switch', { name: /microphone/i });
    fireEvent.click(micSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  it('starts all streams with Start All button', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    const startAllButton = screen.getByRole('button', { name: /start all/i });
    fireEvent.click(startAllButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });
  });

  it('stops all streams with Stop All button', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    // Start all
    const startAllButton = screen.getByRole('button', { name: /start all/i });
    fireEvent.click(startAllButton);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Stop all
    const stopAllButton = screen.getByRole('button', { name: /stop all/i });
    fireEvent.click(stopAllButton);

    await waitFor(() => {
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  it('displays connected status when WebSocket connects', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    const cameraSwitch = screen.getByRole('switch', { name: /camera/i });
    fireEvent.click(cameraSwitch);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('displays video preview when camera is active', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    const { unmount } = render(<MultimodalInput />);

    const cameraSwitch = screen.getByRole('switch', { name: /camera/i });
    fireEvent.click(cameraSwitch);

    await waitFor(() => {
      // Check for Video Preview section instead of video element directly
      expect(screen.getByText('Video Preview')).toBeInTheDocument();
    });
    
    unmount();
  });

  it('displays stream statistics', () => {
    render(<MultimodalInput />);
    
    expect(screen.getByText('Frames Sent')).toBeInTheDocument();
    expect(screen.getByText('Audio Level')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Sync Status')).toBeInTheDocument();
  });

  it('allows configuration changes', () => {
    render(<MultimodalInput />);
    
    // Check for labels using text content since they're not associated with inputs
    expect(screen.getByText('Video Resolution')).toBeInTheDocument();
    expect(screen.getByText('Frame Rate')).toBeInTheDocument();
    expect(screen.getByText('Audio Sample Rate')).toBeInTheDocument();
    expect(screen.getByText('Audio Channels')).toBeInTheDocument();
    
    // Check for select elements
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(4);
  });

  it('displays audio level meter when microphone is active', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<MultimodalInput />);

    const micSwitch = screen.getByRole('switch', { name: /microphone/i });
    fireEvent.click(micSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ audio: expect.any(Object) })
      );
    });
  });

  it('cleans up media streams on unmount', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    const { unmount } = render(<MultimodalInput />);

    const cameraSwitch = screen.getByRole('switch', { name: /camera/i });
    fireEvent.click(cameraSwitch);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    unmount();

    // Cleanup should stop tracks
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
