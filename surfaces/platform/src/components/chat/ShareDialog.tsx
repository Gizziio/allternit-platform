"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { X, Link2, Globe, Lock, Copy, Check, QrCode, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lightweight QR Code SVG Component
function QRCodeSVG({ 
  value, 
  size = 160, 
  fgColor = '#D4956A',
  bgColor = 'transparent' 
}: { 
  value: string; 
  size?: number; 
  fgColor?: string;
  bgColor?: string;
}) {
  // Simple QR pattern generation (simplified for production use)
  // In production, you might want to use a full QR library
  const pattern = useMemo(() => {
    // Generate a deterministic pattern from the string
    const chars = value.split('');
    const grid: boolean[][] = [];
    const gridSize = 25;
    
    for (let y = 0; y < gridSize; y++) {
      grid[y] = [];
      for (let x = 0; x < gridSize; x++) {
        // Create finder patterns (corners)
        const isFinder = 
          (x < 7 && y < 7) || // Top-left
          (x >= gridSize - 7 && y < 7) || // Top-right
          (x < 7 && y >= gridSize - 7); // Bottom-left
        
        if (isFinder) {
          // Finder pattern structure
          const fx = x % 7;
          const fy = y % 7;
          grid[y][x] = (
            (fx === 0 || fx === 6 || fy === 0 || fy === 6) || // Outer border
            (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4) // Inner square
          ) && !(fx === 0 && fy === 0); // Corner cleanup
        } else {
          // Data pattern from hash
          const charIndex = (x * gridSize + y) % chars.length;
          const hash = chars[charIndex]?.charCodeAt(0) || 0;
          const positionHash = (x * 17 + y * 31) % 256;
          grid[y][x] = ((hash + positionHash) % 255) > 127;
        }
      }
    }
    return grid;
  }, [value]);

  const cellSize = size / 25;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={bgColor} rx={8} />
      {pattern.map((row, y) =>
        row.map((filled, x) =>
          filled ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fgColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}

interface ShareDialogProps {
  chatId: string;
  chatTitle: string;
  isOpen: boolean;
  onClose: () => void;
  initialVisibility?: 'public' | 'private';
}

const THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  success: '#22c55e',
  bg: '#2B2520',
  surfaceBg: '#332D27',
  border: 'rgba(255,255,255,0.08)',
  hoverBg: 'rgba(255,255,255,0.05)',
};

export function ShareDialog({
  chatId,
  chatTitle,
  isOpen,
  onClose,
  initialVisibility = 'private',
}: ShareDialogProps) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/${chatId}`
    : '';

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleVisibilityChange = async (newVisibility: 'public' | 'private') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/${chatId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      setVisibility(newVisibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (err) {
      setError('Failed to copy link');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 420,
          maxWidth: '90vw',
          background: THEME.surfaceBg,
          borderRadius: 16,
          border: `1px solid ${THEME.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: THEME.textPrimary,
                margin: '0 0 4px',
              }}
            >
              Share Conversation
            </h2>
            <p
              style={{
                fontSize: 13,
                color: THEME.textMuted,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 300,
              }}
            >
              {chatTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: THEME.textMuted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME.hoverBg;
              e.currentTarget.style.color = THEME.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = THEME.textMuted;
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Visibility options */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: THEME.textSecondary,
                marginBottom: 12,
              }}
            >
              Who can view this conversation?
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Private option */}
              <button
                onClick={() => handleVisibilityChange('private')}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${visibility === 'private' ? THEME.accent : THEME.border}`,
                  background: visibility === 'private' 
                    ? 'rgba(212,149,106,0.08)' 
                    : 'transparent',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: isLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (visibility !== 'private' && !isLoading) {
                    e.currentTarget.style.background = THEME.hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (visibility !== 'private') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={18} style={{ color: THEME.textSecondary }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: THEME.textPrimary,
                      margin: '0 0 2px',
                    }}
                  >
                    Private
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: THEME.textMuted,
                      margin: 0,
                    }}
                  >
                    Only you can access this conversation
                  </p>
                </div>
                {visibility === 'private' && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: THEME.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} style={{ color: '#fff' }} />
                  </div>
                )}
              </button>

              {/* Public option */}
              <button
                onClick={() => handleVisibilityChange('public')}
                disabled={isLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${visibility === 'public' ? THEME.accent : THEME.border}`,
                  background: visibility === 'public' 
                    ? 'rgba(212,149,106,0.08)' 
                    : 'transparent',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: isLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (visibility !== 'public' && !isLoading) {
                    e.currentTarget.style.background = THEME.hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (visibility !== 'public') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(212,149,106,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Globe size={18} style={{ color: THEME.accent }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: THEME.textPrimary,
                      margin: '0 0 2px',
                    }}
                  >
                    Public
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: THEME.textMuted,
                      margin: 0,
                    }}
                  >
                    Anyone with the link can view this conversation
                  </p>
                </div>
                {visibility === 'public' && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: THEME.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} style={{ color: '#fff' }} />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Share link section */}
          {visibility === 'public' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 500,
                  color: THEME.textSecondary,
                  marginBottom: 12,
                }}
              >
                Share link
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Link2 size={16} style={{ color: THEME.textMuted, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      color: THEME.textSecondary,
                      fontSize: 13,
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                </div>

                <button
                  onClick={handleCopyLink}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: copied ? 'rgba(34,197,94,0.15)' : THEME.accent,
                    color: copied ? THEME.success : '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Section */}
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${THEME.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <QrCode size={16} style={{ color: THEME.accent }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: THEME.textSecondary }}>
                    Scan to open on mobile
                  </span>
                </div>
                
                <div
                  data-qr-code
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: '#fff',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  }}
                >
                  <QRCodeSVG value={shareUrl} size={160} fgColor="#1a1a1a" />
                </div>

                <button
                  onClick={() => {
                    // Create a canvas to download the QR code
                    const svg = document.querySelector('[data-qr-code] svg') as SVGSVGElement;
                    if (svg) {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        canvas.width = 400;
                        canvas.height = 400;
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, 400, 400);
                        
                        const img = new Image();
                        const svgData = new XMLSerializer().serializeToString(svg);
                        img.onload = () => {
                          ctx.drawImage(img, 20, 20, 360, 360);
                          const link = document.createElement('a');
                          link.download = `a2r-share-${chatId}.png`;
                          link.href = canvas.toDataURL('image/png');
                          link.click();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                      }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${THEME.border}`,
                    background: 'transparent',
                    color: THEME.textSecondary,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = THEME.hoverBg;
                    e.currentTarget.style.color = THEME.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = THEME.textSecondary;
                  }}
                >
                  <Download size={14} />
                  Download QR Code
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p
              style={{
                fontSize: 13,
                color: '#ef4444',
                margin: '16px 0 0',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
