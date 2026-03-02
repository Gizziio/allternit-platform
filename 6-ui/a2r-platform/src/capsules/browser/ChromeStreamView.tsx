/**
 * ChromeStreamView - WebRTC client for streaming real Chrome
 * 
 * Connects to Chrome streaming session via WebRTC, receives video stream,
 * and forwards mouse/keyboard/touch input to remote Chrome.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface ChromeStreamViewProps {
  sessionId: string;
  signalingUrl: string;
  iceServers?: RTCIceServer[];
  resolution?: string;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onDisconnect?: () => void;
}

export const ChromeStreamView: React.FC<ChromeStreamViewProps> = ({
  sessionId,
  signalingUrl,
  iceServers,
  resolution = '1920x1080',
  onStatusChange,
  onDisconnect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const signalingWsRef = useRef<WebSocket | null>(null);
  
  // Parse resolution
  const [width, height] = resolution.split('x').map(Number);

  // Coordinate translation: video element → remote display
  const translateCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!videoRef.current) return { x: 0, y: 0 };
    
    const rect = videoRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [width, height]);

  // Send input via data channel
  const sendInput = useCallback((message: object) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = translateCoordinates(e.clientX, e.clientY);
    sendInput({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  }, [translateCoordinates, sendInput]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const { x, y } = translateCoordinates(e.clientX, e.clientY);
    sendInput({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }, [translateCoordinates, sendInput]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 0) return; // Only send when button is pressed
    const { x, y } = translateCoordinates(e.clientX, e.clientY);
    sendInput({ type: 'mouseMoved', x, y });
  }, [translateCoordinates, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    sendInput({ type: 'mouseWheel', deltaX: e.deltaX, deltaY: e.deltaY });
  }, [sendInput]);

  // Keyboard event handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    sendInput({ type: 'keyDown', key: e.key, code: e.code });
    e.preventDefault();
  }, [sendInput]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    sendInput({ type: 'keyUp', key: e.key, code: e.code });
    e.preventDefault();
  }, [sendInput]);

  // Touch event handlers (translate to mouse events)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const { x, y } = translateCoordinates(touch.clientX, touch.clientY);
    sendInput({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    e.preventDefault();
  }, [translateCoordinates, sendInput]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const { x, y } = translateCoordinates(touch.clientX, touch.clientY);
    sendInput({ type: 'mouseMoved', x, y });
    e.preventDefault();
  }, [translateCoordinates, sendInput]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { x, y } = translateCoordinates(touch.clientX, touch.clientY);
    sendInput({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    e.preventDefault();
  }, [translateCoordinates, sendInput]);

  // Initialize WebRTC connection
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        setStatus('connecting');
        onStatusChange?.('connecting');

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: iceServers || [{ urls: ['stun:stun.l.google.com:19302'] }],
        });

        peerConnectionRef.current = pc;

        // Handle incoming video track
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE connection state changes
        pc.oniceconnectionstatechange = () => {
          if (cancelled) return;
          
          switch (pc.iceConnectionState) {
            case 'connected':
              setStatus('connected');
              onStatusChange?.('connected');
              break;
            case 'disconnected':
            case 'failed':
            case 'closed':
              setStatus('disconnected');
              onStatusChange?.('disconnected');
              onDisconnect?.();
              break;
          }
        };

        // Connect to signaling WebSocket
        const ws = new WebSocket(signalingUrl);
        signalingWsRef.current = ws;

        ws.onopen = async () => {
          if (cancelled) return;

          // Create SDP offer
          const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true,
          });

          await pc.setLocalDescription(offer);

          // Send offer to signaling server
          ws.send(JSON.stringify({
            type: 'offer',
            sdp: offer.sdp,
          }));
        };

        ws.onmessage = async (event) => {
          if (cancelled) return;

          const message = JSON.parse(event.data);

          if (message.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({
              type: 'answer',
              sdp: message.sdp,
            }));
          } else if (message.type === 'ice-candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } else if (message.type === 'data-channel') {
            // Data channel for input
            const dc = pc.createDataChannel('input', message.options);
            dataChannelRef.current = dc;

            dc.onopen = () => {
              console.log('[ChromeStream] Data channel opened');
            };

            dc.onclose = () => {
              console.log('[ChromeStream] Data channel closed');
            };
          }
        };

        ws.onerror = (error) => {
          console.error('[ChromeStream] Signaling error:', error);
          setError('Signaling connection failed');
          setStatus('error');
          onStatusChange?.('error');
        };

        ws.onclose = () => {
          if (!cancelled && status !== 'disconnected') {
            setStatus('disconnected');
            onStatusChange?.('disconnected');
          }
        };

      } catch (err) {
        console.error('[ChromeStream] Connection error:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStatus('error');
        onStatusChange?.('error');
      }
    };

    connect();

    // Cleanup
    return () => {
      cancelled = true;
      
      if (signalingWsRef.current) {
        signalingWsRef.current.close();
        signalingWsRef.current = null;
      }
      
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [sessionId, signalingUrl, iceServers, onStatusChange, onDisconnect]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0A0908' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          outline: 'none',
        }}
      />
      
      {/* Status overlay */}
      {status !== 'connected' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 9, 8, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#D4B08C',
          fontSize: 14,
          fontWeight: 600,
        }}>
          {status === 'connecting' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="#D4B08C" strokeWidth="2" strokeOpacity="0.3" />
                  <path d="M20 10V20L27 27" stroke="#D4B08C" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 10 }}>
                Connecting to Chrome...
              </div>
            </>
          )}
          
          {status === 'disconnected' && (
            <>
              <div style={{ marginBottom: 16, opacity: 0.5 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="#D4B08C" strokeWidth="2" />
                  <path d="M14 14L26 26M26 14L14 26" stroke="#D4B08C" strokeWidth="2" />
                </svg>
              </div>
              <div style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 10 }}>
                Disconnected
              </div>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div style={{ marginBottom: 16, color: '#EF4444' }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="#EF4444" strokeWidth="2" />
                  <path d="M20 14V20M20 26V26" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 10, color: '#EF4444' }}>
                {error || 'Connection Error'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChromeStreamView;
