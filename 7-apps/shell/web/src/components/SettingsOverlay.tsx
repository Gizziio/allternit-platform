import React, { useCallback } from 'react';
import { User, Server, Settings, X, Sparkles } from 'lucide-react';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSection: (section: 'signin' | 'vps' | 'providers' | 'general') => void;
}

/**
 * SettingsOverlay - Modal overlay that appears when clicking gear icon
 * 
 * Shows quick access to main settings sections with dark theme.
 */
export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isOpen,
  onClose,
  onOpenSection
}) => {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const darkTheme = {
    bg: 'rgba(0, 0, 0, 0.75)',
    cardBg: '#1a1a1a',
    cardHover: '#242424',
    border: '#333333',
    textPrimary: '#e5e5e5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    accent: '#d4b08c'
  };

  const sections = [
    {
      id: 'signin' as const,
      title: 'Sign In',
      description: 'Manage your account and authentication',
      icon: User,
      color: '#d4b08c'
    },
    {
      id: 'vps' as const,
      title: 'VPS Connections',
      description: 'Connect your own servers for agent execution',
      icon: Server,
      color: '#34c759'
    },
    {
      id: 'providers' as const,
      title: 'AI Providers',
      description: 'Connect Anthropic, OpenAI, and other AI services',
      icon: Sparkles,
      color: '#a855f7'
    },
    {
      id: 'general' as const,
      title: 'General Settings',
      description: 'Appearance, models, API keys, and more',
      icon: Settings,
      color: '#60a5fa'
    }
  ];

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: darkTheme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          background: darkTheme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${darkTheme.border}`,
          maxWidth: '480px',
          width: '90%',
          padding: '32px',
          position: 'relative',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkTheme.cardHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X style={{ width: '20px', height: '20px', color: darkTheme.textTertiary }} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: darkTheme.textPrimary,
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>
            Settings
          </h2>
          <p style={{
            fontSize: '14px',
            color: darkTheme.textTertiary,
            lineHeight: '1.5'
          }}>
            Choose a section to configure your A2R Platform experience
          </p>
        </div>

        {/* Section Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                onOpenSection(section.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                background: darkTheme.cardBg,
                border: `1px solid ${darkTheme.border}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkTheme.cardHover;
                e.currentTarget.style.borderColor = darkTheme.accent;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkTheme.cardBg;
                e.currentTarget.style.borderColor = darkTheme.border;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Icon */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `${section.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <section.icon style={{ width: '24px', height: '24px', color: section.color }} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: darkTheme.textPrimary,
                  marginBottom: '6px',
                  letterSpacing: '-0.01em'
                }}>
                  {section.title}
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: darkTheme.textTertiary,
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  {section.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: `1px solid ${darkTheme.border}`,
          textAlign: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: `1px solid ${darkTheme.border}`,
              borderRadius: '8px',
              color: darkTheme.textSecondary,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkTheme.cardHover;
              e.currentTarget.style.borderColor = darkTheme.textTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = darkTheme.border;
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsOverlay;
