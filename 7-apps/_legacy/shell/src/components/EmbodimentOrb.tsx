import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

interface EmbodimentOrbProps {
  endpoint: string;
}

export const EmbodimentOrb: React.FC<EmbodimentOrbProps> = ({ endpoint }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isActive, setIsActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize connection to embodiment stream
  useEffect(() => {
    setConnectionStatus('connecting');
    
    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        console.log('Connected to embodiment stream:', endpoint);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Update orb based on embodiment data
          setIsActive(!!data.active || !!data.processing || !!data.thinking);
        } catch (e) {
          console.warn('Could not parse embodiment stream data:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Embodiment stream error:', error);
        setConnectionStatus('disconnected');
        eventSource.close();
      };

      return () => {
        eventSource.close();
        eventSourceRef.current = null;
      };
    } catch (error) {
      console.error('Failed to connect to embodiment stream:', error);
      setConnectionStatus('disconnected');
    }
  }, [endpoint]);

  // Animation effect for the orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 60;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let time = 0;
    const centerX = size / 2;
    const centerY = size / 2;

    const drawOrb = () => {
      ctx.clearRect(0, 0, size, size);

      // Base radius
      const baseRadius = 20;
      
      // Pulsing effect when active
      const pulseAmount = isActive ? 5 + Math.sin(time * 3) * 3 : 2;
      const currentRadius = baseRadius + pulseAmount;

      // Background glow
      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, currentRadius * 1.8
      );

      if (connectionStatus === 'connected') {
        if (isActive) {
          // Active state - brighter colors
          glowGradient.addColorStop(0, 'rgba(52, 211, 153, 0.6)');
          glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.4)');
          glowGradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
        } else {
          // Inactive state - softer colors
          glowGradient.addColorStop(0, 'rgba(167, 139, 250, 0.4)');
          glowGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.2)');
          glowGradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
        }
      } else {
        // Disconnected state - dimmer colors
        glowGradient.addColorStop(0, 'rgba(150, 150, 150, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(100, 100, 100, 0.15)');
        glowGradient.addColorStop(1, 'rgba(50, 50, 50, 0)');
      }

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, size, size);

      // Main orb
      const orbGradient = ctx.createRadialGradient(
        centerX - 8, centerY - 8, 0,
        centerX, centerY, currentRadius
      );

      if (connectionStatus === 'connected') {
        if (isActive) {
          // Active gradient
          orbGradient.addColorStop(0, '#34d399'); // green-400
          orbGradient.addColorStop(0.4, '#60a5fa'); // blue-400
          orbGradient.addColorStop(0.7, '#a78bfa'); // violet-400
          orbGradient.addColorStop(1, '#f472b6'); // pink-400
        } else {
          // Inactive gradient
          orbGradient.addColorStop(0, '#a78bfa'); // violet-400
          orbGradient.addColorStop(0.4, '#60a5fa'); // blue-400
          orbGradient.addColorStop(1, '#c084fc'); // violet-300
        }
      } else {
        // Disconnected gradient
        orbGradient.addColorStop(0, '#9ca3af'); // gray-400
        orbGradient.addColorStop(0.4, '#6b7280'); // gray-500
        orbGradient.addColorStop(1, '#4b5563'); // gray-600
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = orbGradient;
      ctx.fill();

      // Inner highlight
      const highlightGradient = ctx.createRadialGradient(
        centerX - 6, centerY - 6, 0,
        centerX, centerY, currentRadius * 0.7
      );
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = highlightGradient;
      ctx.fill();

      // Connection indicator ring
      if (connectionStatus !== 'connected') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius + 4, 0, Math.PI * 2);
        
        if (connectionStatus === 'connecting') {
          // Pulsing yellow ring for connecting
          const pulse = 0.3 + Math.abs(Math.sin(time * 2)) * 0.4;
          ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`; // amber-400
        } else {
          // Solid red ring for disconnected
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // red-500
        }
        
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      time += 0.05;
      animationRef.current = requestAnimationFrame(drawOrb);
    };

    drawOrb();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, connectionStatus]);

  return (
    <div className="embodiment-orb-container" title={`Status: ${connectionStatus}`}>
      <canvas 
        ref={canvasRef} 
        className="embodiment-orb-canvas"
        style={{ width: '60px', height: '60px' }}
      />
      <div className="embodiment-status-indicator">
        {connectionStatus === 'connected' 
          ? (isActive ? 'Processing...' : 'Ready') 
          : connectionStatus === 'connecting' 
            ? 'Connecting...' 
            : 'Disconnected'}
      </div>
    </div>
  );
};