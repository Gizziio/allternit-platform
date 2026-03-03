import React, { useState, useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Server, Plus, Trash2, CheckCircle, XCircle, Key, Link, Zap, Shield, Clock } from 'lucide-react';
import { GlassCard, GlassSurface } from '@a2r/platform';

export interface VPSConnection {
  id: string;
  name: string;
  host: string;
  apiKey: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
}

interface VPSStore {
  connections: VPSConnection[];
  activeConnection: VPSConnection | null;
  addConnection: (conn: Omit<VPSConnection, 'id'>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (conn: VPSConnection | null) => void;
  testConnection: (conn: VPSConnection) => Promise<boolean>;
}

const useVPSStore = create<VPSStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,

      addConnection: (conn) => {
        const newConn = { ...conn, id: crypto.randomUUID() };
        set((state) => ({
          connections: [...state.connections, newConn]
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter(c => c.id !== id),
          activeConnection: state.activeConnection?.id === id
            ? null
            : state.activeConnection
        }));
      },

      setActiveConnection: (conn) => {
        set({ activeConnection: conn });
        if (conn) {
          sessionStorage.setItem('a2r-active-vps', JSON.stringify(conn));
        } else {
          sessionStorage.removeItem('a2r-active-vps');
        }
      },

      testConnection: async (conn) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(`${conn.host}/health`, {
            headers: { 
              'Authorization': `Bearer ${conn.apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response.ok;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'a2r-vps-connections',
      partialize: (state) => ({ connections: state.connections })
    }
  )
);

/**
 * VPSConnectionsPanel - Production VPS Connection Management
 * 
 * Dark mode themed panel matching A2R platform design.
 */
export const VPSConnectionsPanel: React.FC = () => {
  const { connections, addConnection, removeConnection, testConnection } = useVPSStore();
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; timestamp: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const [newConnection, setNewConnection] = useState({
    name: '',
    host: '',
    apiKey: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dark theme colors
  const darkTheme = {
    bg: '#1a1a1a',
    bgSecondary: '#242424',
    bgTertiary: '#2a2a2a',
    border: '#333333',
    borderStrong: '#404040',
    textPrimary: '#e5e5e5',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    accent: '#d4b08c',
    accentHover: '#c4a07c',
    success: '#34c759',
    error: '#ef4444'
  };

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!newConnection.name.trim()) {
      errors.name = 'Connection name is required';
    }
    
    if (!newConnection.host.trim()) {
      errors.host = 'Host URL is required';
    } else if (!/^https?:\/\//.test(newConnection.host)) {
      errors.host = 'URL must start with http:// or https://';
    }
    
    if (!newConnection.apiKey.trim()) {
      errors.apiKey = 'API key is required';
    } else if (newConnection.apiKey.length < 10) {
      errors.apiKey = 'API key appears too short';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newConnection]);

  const handleAddConnection = useCallback(() => {
    if (!validateForm()) return;
    
    try {
      addConnection({
        name: newConnection.name.trim(),
        host: newConnection.host.trim(),
        apiKey: newConnection.apiKey.trim(),
        status: 'disconnected'
      });
      setNewConnection({ name: '', host: '', apiKey: '' });
      setFormErrors({});
      setIsAddingConnection(false);
      setError(null);
    } catch (err) {
      setError('Failed to add connection. Please try again.');
      console.error('Add connection error:', err);
    }
  }, [newConnection, validateForm, addConnection]);

  const handleRemoveConnection = useCallback((id: string) => {
    try {
      removeConnection(id);
      setTestResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setError(null);
    } catch (err) {
      setError('Failed to remove connection. Please try again.');
      console.error('Remove connection error:', err);
    }
  }, [removeConnection]);

  const handleTestConnection = useCallback(async (conn: VPSConnection) => {
    setTestingId(conn.id);
    setError(null);
    
    try {
      const success = await testConnection(conn);
      setTestResults(prev => ({
        ...prev,
        [conn.id]: { success, timestamp: Date.now() }
      }));
    } catch (err) {
      setError('Failed to test connection. Please check your settings.');
      console.error('Test connection error:', err);
    } finally {
      setTestingId(null);
    }
  }, [testConnection]);

  const handleCancel = useCallback(() => {
    setIsAddingConnection(false);
    setNewConnection({ name: '', host: '', apiKey: '' });
    setFormErrors({});
    setError(null);
  }, []);

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
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Server style={{ width: '22px', height: '22px', color: darkTheme.accent }} />
              <h2 style={{
                fontSize: '22px',
                fontWeight: '600',
                color: darkTheme.textPrimary,
                letterSpacing: '-0.02em'
              }}>
                VPS Connections
              </h2>
            </div>
            <p style={{
              fontSize: '14px',
              color: darkTheme.textTertiary,
              lineHeight: '1.6',
              maxWidth: '560px'
            }}>
              Connect your own servers to run AI agents with full browser automation. Your data stays on your infrastructure.
            </p>
          </div>
          
          {!isAddingConnection && (
            <button
              onClick={() => setIsAddingConnection(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 20px',
                background: darkTheme.accent,
                border: 'none',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
              <Plus style={{ width: '16px', height: '16px' }} />
              Add VPS
            </button>
          )}
        </div>
      </div>

      {/* Add Connection Form */}
      {isAddingConnection && (
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${darkTheme.border}`
          }}>
            <Shield style={{ width: '20px', height: '20px', color: darkTheme.accent }} />
            <h4 style={{ 
              fontSize: '15px', 
              fontWeight: '600', 
              color: darkTheme.textPrimary,
              letterSpacing: '-0.01em'
            }}>
              Add New VPS Connection
            </h4>
          </div>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: darkTheme.textSecondary,
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                Connection Name
              </label>
              <input
                type="text"
                value={newConnection.name}
                onChange={(e) => {
                  setNewConnection({ ...newConnection, name: e.target.value });
                  setFormErrors({ ...formErrors, name: '' });
                }}
                placeholder="My Production Server"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: darkTheme.bg,
                  border: `1px solid ${formErrors.name ? darkTheme.error : darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!formErrors.name) {
                    e.target.style.borderColor = darkTheme.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = formErrors.name ? darkTheme.error : darkTheme.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {formErrors.name && (
                <p style={{ 
                  fontSize: '12px', 
                  color: darkTheme.error, 
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <XCircle style={{ width: '12px', height: '12px' }} />
                  {formErrors.name}
                </p>
              )}
            </div>

            <div>
              <label style={{ 
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: darkTheme.textSecondary,
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                Host URL
              </label>
              <input
                type="url"
                value={newConnection.host}
                onChange={(e) => {
                  setNewConnection({ ...newConnection, host: e.target.value });
                  setFormErrors({ ...formErrors, host: '' });
                }}
                placeholder="https://5.189.170.23:3010"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: darkTheme.bg,
                  border: `1px solid ${formErrors.host ? darkTheme.error : darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!formErrors.host) {
                    e.target.style.borderColor = darkTheme.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = formErrors.host ? darkTheme.error : darkTheme.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {formErrors.host && (
                <p style={{ 
                  fontSize: '12px', 
                  color: darkTheme.error, 
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <XCircle style={{ width: '12px', height: '12px' }} />
                  {formErrors.host}
                </p>
              )}
            </div>

            <div>
              <label style={{ 
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: darkTheme.textSecondary,
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                API Key
              </label>
              <input
                type="password"
                value={newConnection.apiKey}
                onChange={(e) => {
                  setNewConnection({ ...newConnection, apiKey: e.target.value });
                  setFormErrors({ ...formErrors, apiKey: '' });
                }}
                placeholder="Your VPS API key"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: darkTheme.bg,
                  border: `1px solid ${formErrors.apiKey ? darkTheme.error : darkTheme.border}`,
                  borderRadius: '8px',
                  color: darkTheme.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!formErrors.apiKey) {
                    e.target.style.borderColor = darkTheme.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 176, 140, 0.1)`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = formErrors.apiKey ? darkTheme.error : darkTheme.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
              {formErrors.apiKey && (
                <p style={{ 
                  fontSize: '12px', 
                  color: darkTheme.error, 
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <XCircle style={{ width: '12px', height: '12px' }} />
                  {formErrors.apiKey}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '14px', paddingTop: '8px' }}>
              <button
                onClick={handleAddConnection}
                style={{
                  flex: 1,
                  padding: '14px 24px',
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
                Save Connection
              </button>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: '14px 24px',
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
                Cancel
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Connection List */}
      {connections.length === 0 ? (
        <GlassCard 
          elevation="flat" 
          blur="sm" 
          padding="xl" 
          rounded="lg"
          style={{
            textAlign: 'center',
            border: `2px dashed ${darkTheme.border}`,
            background: darkTheme.bgSecondary
          }}
        >
          <div style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 24px',
            borderRadius: '18px',
            background: 'rgba(212, 176, 140, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Server style={{ width: '36px', height: '36px', color: darkTheme.accent }} />
          </div>
          <h4 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: darkTheme.textPrimary,
            marginBottom: '10px',
            letterSpacing: '-0.01em'
          }}>
            No VPS Connections
          </h4>
          <p style={{ 
            fontSize: '13px', 
            color: darkTheme.textTertiary,
            marginBottom: '28px',
            maxWidth: '420px',
            margin: '0 auto 28px',
            lineHeight: '1.6'
          }}>
            Add your first VPS to start running AI agents on your own infrastructure. Your data stays on your servers with full privacy.
          </p>
          {!isAddingConnection && (
            <button
              onClick={() => setIsAddingConnection(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
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
              <Plus style={{ width: '16px', height: '16px' }} />
              Add Your First VPS
            </button>
          )}
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {connections.map((conn) => {
            const testResult = testResults[conn.id];
            const isTesting = testingId === conn.id;
            
            return (
              <GlassCard 
                key={conn.id}
                elevation="raised" 
                blur="md" 
                padding="md" 
                rounded="lg"
                style={{ 
                  background: darkTheme.bgSecondary,
                  borderColor: darkTheme.border
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px'
                }}>
                  {/* Icon */}
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    background: conn.status === 'connected' 
                      ? 'rgba(52, 199, 89, 0.12)' 
                      : conn.status === 'error'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(212, 176, 140, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Server 
                      style={{ 
                        width: '26px', 
                        height: '26px', 
                        color: conn.status === 'connected' 
                          ? darkTheme.success
                          : conn.status === 'error'
                          ? darkTheme.error
                          : darkTheme.accent
                      }} 
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h4 style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: darkTheme.textPrimary,
                        margin: 0,
                        letterSpacing: '-0.01em'
                      }}>
                        {conn.name}
                      </h4>
                      {conn.status === 'connected' && (
                        <CheckCircle style={{ width: '16px', height: '16px', color: darkTheme.success, flexShrink: 0 }} />
                      )}
                      {conn.status === 'error' && (
                        <XCircle style={{ width: '16px', height: '16px', color: darkTheme.error, flexShrink: 0 }} />
                      )}
                      {testResult?.success === true && (
                        <CheckCircle style={{ width: '16px', height: '16px', color: darkTheme.success, flexShrink: 0 }} />
                      )}
                      {testResult?.success === false && (
                        <XCircle style={{ width: '16px', height: '16px', color: darkTheme.error, flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: darkTheme.textTertiary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      <Link style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '400px'
                      }}>
                        {conn.host}
                      </span>
                      {testResult && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontSize: '11px',
                          color: testResult.success ? darkTheme.success : darkTheme.error
                        }}>
                          <Clock style={{ width: '10px', height: '10px' }} />
                          {new Date(testResult.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={isTesting}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        background: isTesting 
                          ? darkTheme.border
                          : 'transparent',
                        border: `1px solid ${darkTheme.borderStrong}`,
                        borderRadius: '8px',
                        color: darkTheme.textPrimary,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: isTesting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        opacity: isTesting ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isTesting) {
                          e.currentTarget.style.background = darkTheme.bgTertiary;
                          e.currentTarget.style.borderColor = darkTheme.border;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isTesting) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = darkTheme.borderStrong;
                        }
                      }}
                    >
                      {isTesting ? (
                        <>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            border: `2px solid ${darkTheme.textTertiary}`,
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                          }} />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Zap style={{ width: '14px', height: '14px' }} />
                          Test
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveConnection(conn.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        background: 'transparent',
                        border: `1px solid rgba(239, 68, 68, 0.3)`,
                        borderRadius: '8px',
                        color: darkTheme.error,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                      Remove
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <GlassSurface 
        elevation="flat"
        border="accent"
        padding="md"
        rounded="lg"
        style={{
          marginTop: '28px',
          background: 'rgba(212, 176, 140, 0.06)',
          borderColor: 'rgba(212, 176, 140, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(212, 176, 140, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Key style={{ width: '20px', height: '20px', color: darkTheme.accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: darkTheme.accent,
              marginBottom: '8px',
              letterSpacing: '-0.01em'
            }}>
              About VPS Connections
            </h4>
            <p style={{ 
              fontSize: '13px', 
              color: darkTheme.textTertiary,
              lineHeight: '1.6',
              margin: 0
            }}>
              VPS connections enable you to run AI agents on your own infrastructure. 
              Your data remains on your servers while using the A2R Platform interface. 
              Install the A2R runtime on your VPS to enable secure communication and agent execution.
            </p>
          </div>
        </div>
      </GlassSurface>
    </div>
  );
};

export default VPSConnectionsPanel;
