import React, { useState, useCallback } from 'react';
import { UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { LogOut, User, Mail, CheckCircle, Shield, Sparkles } from 'lucide-react';
import { GlassCard, GlassSurface } from '@a2r/platform';

/**
 * ClerkAuthPanel - Production Authentication Management for A2R Platform
 * 
 * Dark mode themed authentication panel matching A2R platform design.
 */
export const ClerkAuthPanel: React.FC = () => {
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      setError(null);
      await signOut();
    } catch (err) {
      setError('Failed to sign out. Please try again.');
      console.error('Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  }, [signOut]);

  const handleOpenProfile = useCallback(() => {
    try {
      (window as any).Clerk?.openUserProfile?.();
    } catch (err) {
      setError('Failed to open profile. Please try again.');
      console.error('Profile error:', err);
    }
  }, []);

  const handleOpenSignIn = useCallback(() => {
    try {
      (window as any).Clerk?.openSignIn?.();
    } catch (err) {
      setError('Failed to open sign in. Please try again.');
      console.error('Sign in error:', err);
    }
  }, []);

  const handleOpenSignUp = useCallback(() => {
    try {
      (window as any).Clerk?.openSignUp?.();
    } catch (err) {
      setError('Failed to open sign up. Please try again.');
      console.error('Sign up error:', err);
    }
  }, []);

  // Dark theme colors
  const darkTheme = {
    bg: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    textPrimary: '#ffffff',
    textSecondary: '#d0d0d0',
    textTertiary: '#a0a0a0',
    accent: '#d4b08c',
    accentHover: '#c4a07c',
    success: '#34c759',
    error: '#ef4444'
  };

  if (!isLoaded || !isUserLoaded) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <GlassCard 
          elevation="raised" 
          blur="md" 
          padding="xl" 
          rounded="lg"
          style={{ background: darkTheme.bgSecondary, borderColor: darkTheme.border }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '32px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${darkTheme.accent}`,
              borderTop: '3px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ 
              fontSize: '14px', 
              color: darkTheme.textPrimary,
              fontWeight: '500'
            }}>
              Loading authentication...
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isSignedIn && user) {
    return (
      <div style={{ padding: '40px 32px' }}>
        {error && (
          <GlassSurface 
            elevation="flat"
            border="accent"
            padding="sm"
            rounded="md"
            style={{
              marginBottom: '20px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }}
          >
            <div style={{ 
              fontSize: '13px', 
              color: darkTheme.error,
              fontWeight: '500'
            }}>
              {error}
            </div>
          </GlassSurface>
        )}

        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '12px'
          }}>
            <Shield style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
            <h2 style={{
              fontSize: '22px',
              fontWeight: '600',
              color: darkTheme.textPrimary,
              letterSpacing: '-0.02em'
            }}>
              Authentication
            </h2>
          </div>
          <p style={{
            fontSize: '14px',
            color: darkTheme.textTertiary,
            lineHeight: '1.6',
            maxWidth: '520px'
          }}>
            Manage your A2R Platform account, session preferences, and security settings.
          </p>
        </div>

        {/* User Profile Card */}
        <GlassCard 
          elevation="raised" 
          blur="md" 
          padding="lg" 
          rounded="lg"
          style={{ 
            marginBottom: '20px',
            background: darkTheme.bgSecondary,
            borderColor: darkTheme.border
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-16 h-16",
                  }
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                width: '18px',
                height: '18px',
                background: darkTheme.success,
                border: `3px solid ${darkTheme.bg}`,
                borderRadius: '50%'
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: darkTheme.textPrimary,
                marginBottom: '6px',
                letterSpacing: '-0.01em'
              }}>
                {user.fullName || user.primaryEmailAddress?.emailAddress}
              </h3>
              <p style={{ 
                fontSize: '13px', 
                color: darkTheme.textTertiary,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Mail style={{ width: '14px', height: '14px' }} />
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>

          <GlassSurface 
            elevation="flat"
            border="subtle"
            padding="sm"
            rounded="md"
            style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(52, 199, 89, 0.08)',
              borderColor: 'rgba(52, 199, 89, 0.2)'
            }}
          >
            <CheckCircle style={{ width: '18px', height: '18px', color: darkTheme.success }} />
            <span style={{ fontSize: '13px', color: darkTheme.success, fontWeight: '500' }}>
              Account verified and active
            </span>
          </GlassSurface>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: `1px solid rgba(239, 68, 68, 0.2)`,
              borderRadius: '8px',
              color: darkTheme.error,
              fontSize: '13px',
              fontWeight: '600',
              cursor: isSigningOut ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'all 0.2s ease',
              opacity: isSigningOut ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isSigningOut) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSigningOut) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              }
            }}
          >
            <LogOut style={{ width: '16px', height: '16px' }} />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </GlassCard>

        {/* Account Management */}
        <GlassCard 
          elevation="raised" 
          blur="md" 
          padding="lg" 
          rounded="lg"
          style={{ 
            background: darkTheme.bgSecondary,
            borderColor: darkTheme.border
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${darkTheme.border}`
          }}>
            <Sparkles style={{ width: '18px', height: '18px', color: darkTheme.accent }} />
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: darkTheme.textPrimary,
              letterSpacing: '-0.01em'
            }}>
              Account Management
            </h4>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleOpenProfile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                background: darkTheme.accent,
                border: 'none',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkTheme.accentHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkTheme.accent;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <User style={{ width: '16px', height: '16px' }} />
              Manage Profile
            </button>

            <button
              onClick={handleOpenSignIn}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                background: 'transparent',
                border: `1px solid ${darkTheme.borderStrong}`,
                borderRadius: '8px',
                color: darkTheme.textPrimary,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkTheme.bgTertiary;
                e.currentTarget.style.borderColor = darkTheme.border;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = darkTheme.borderStrong;
              }}
            >
              <Mail style={{ width: '16px', height: '16px' }} />
              Add Account
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Not signed in - Show sign in/up options
  return (
    <div style={{ padding: '40px 32px' }}>
      {error && (
        <GlassSurface 
          elevation="flat"
          border="accent"
          padding="sm"
          rounded="md"
          style={{
            marginBottom: '20px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}
        >
          <div style={{ 
            fontSize: '13px', 
            color: darkTheme.error,
            fontWeight: '500'
          }}>
            {error}
          </div>
        </GlassSurface>
      )}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '12px'
        }}>
          <Shield style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: darkTheme.textPrimary,
            letterSpacing: '-0.02em'
          }}>
            Sign In to A2R Platform
          </h2>
        </div>
        <p style={{
          fontSize: '14px',
          color: darkTheme.textTertiary,
          lineHeight: '1.6',
          maxWidth: '520px'
        }}>
          Sign in to sync your settings, VPS connections, and agent configurations across devices.
        </p>
      </div>

      {/* Sign In Card */}
      <GlassCard 
        elevation="raised" 
        blur="md" 
        padding="lg" 
        rounded="lg" 
        style={{ 
          marginBottom: '24px',
          background: darkTheme.bgSecondary,
          borderColor: darkTheme.border
        }}
      >
        <h4 style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          color: darkTheme.textPrimary,
          marginBottom: '24px',
          letterSpacing: '-0.01em'
        }}>
          Already have an account?
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <button
            onClick={handleOpenSignIn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              background: darkTheme.accent,
              border: 'none',
              borderRadius: '8px',
              color: '#1a1a1a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkTheme.accentHover;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = darkTheme.accent;
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Sign In
          </button>

          <button
            onClick={handleOpenSignUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              background: 'transparent',
              border: `1px solid ${darkTheme.borderStrong}`,
              borderRadius: '8px',
              color: darkTheme.textPrimary,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkTheme.bgTertiary;
              e.currentTarget.style.borderColor = darkTheme.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = darkTheme.borderStrong;
            }}
          >
            Create Account
          </button>
        </div>
      </GlassCard>

      {/* Benefits */}
      <GlassCard 
        elevation="flat" 
        blur="sm" 
        padding="lg" 
        rounded="lg"
        style={{ 
          background: darkTheme.bgSecondary,
          borderColor: darkTheme.border
        }}
      >
        <h4 style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          color: darkTheme.textPrimary,
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${darkTheme.border}`,
          letterSpacing: '-0.01em'
        }}>
          Why sign in?
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {[
            { 
              title: 'Sync VPS connections', 
              desc: 'Access your servers across all devices seamlessly',
              icon: Shield
            },
            { 
              title: 'Save configurations', 
              desc: 'Agent preferences and settings persist automatically',
              icon: CheckCircle
            },
            { 
              title: 'Cloud features', 
              desc: 'Deploy and manage agents remotely with full control',
              icon: Sparkles
            }
          ].map((benefit, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgba(212, 176, 140, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}>
                <benefit.icon style={{ width: '13px', height: '13px', color: darkTheme.accent }} />
              </div>
              <div>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  color: darkTheme.textPrimary,
                  marginBottom: '4px',
                  letterSpacing: '-0.01em'
                }}>
                  {benefit.title}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: darkTheme.textTertiary,
                  lineHeight: '1.5'
                }}>
                  {benefit.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

export default ClerkAuthPanel;
