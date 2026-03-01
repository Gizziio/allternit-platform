import * as React from 'react';
import { useBrain, BrainProfile, BrainType } from '../runtime/BrainContext';
import '../styles/brain-manager-redesigned.css';

interface RuntimeState {
  runtime_id: string;
  installed: boolean;
  last_verified: number;
  auth_complete: boolean;
  detected_version?: string;
}

const EVENT_TO_STEP: Record<string, number> = {
  'integration.profile.registered': 0,
  'integration.pty.initializing': 1,
  'integration.pty.ready': 2,
  'integration.dispatcher.connected': 3,
  'integration.tools.verified': 4,
  'integration.context.synced': 5,
  'integration.complete': 6,
};

const INSTALL_STEPS = [
  'Registering Profile with Neural Router',
  'Initializing PTY Runtime Wrapper',
  'Connecting to Intent Dispatcher',
  'Verifying Tool Access (Action Planner)',
  'Synchronizing Distributed Context (DCD)',
  'Complete',
];

function getStatusStyle(status: RuntimeStatus): string {
  const styles = {
    not_installed: 'status-not-installed',
    installed: 'status-installed',
    auth_required: 'status-auth-required',
    ready: 'status-ready',
    running: 'status-running',
    error: 'status-error',
  };
  return styles[status];
}

function getStatusLabel(status: RuntimeStatus): string {
  const labels = {
    not_installed: 'Not installed',
    installed: 'Installed',
    auth_required: 'Auth required',
    ready: 'Ready',
    running: 'Running',
    error: 'Error',
  };
  return labels[status];
}

function getExecutionBadge(runtime_type: 'api' | 'cli' | 'local'): string {
  const badges = {
    api: 'badge-api',
    cli: 'badge-cli',
    local: 'badge-local',
  };
  return badges[runtime_type];
}

function getExecutionBadgeLabel(runtime_type: 'api' | 'cli' | 'local'): string {
  const labels = {
    api: 'API',
    cli: 'CLI',
    local: 'LOCAL',
  };
  return labels[runtime_type];
}

interface BrainRuntimeTabProps {
  isOpen: boolean;
  onClose: () => void;
}

type RuntimeStatus = 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error' | 'running';

interface RuntimePreset {
  id: string;
  name: string;
  vendor: string;
  runtime_type: 'api' | 'cli' | 'local';
  logo_asset: string;
  description: string;
  capabilities: string[];
  auth_required: boolean;
  auth_instructions?: string;
  auth_detection_regex?: string;
  check_cmd: string;
  install_cmd?: string;
  install_platform?: {
    darwin?: string;
    linux?: string;
    windows?: string;
  };
  run_cmd: string;
  run_args: string[];
  event_mode: string;
}

interface RuntimeGroup {
  title: string;
  runtimes: RuntimePreset[];
}

interface FormErrors {
  [key: string]: string;
}

export const BrainRuntimeTab: React.FC<BrainRuntimeTabProps> = ({ isOpen, onClose }) => {
  const { profiles, activeSession, createSession, refreshProfiles } = useBrain();

  const [view, setView] = React.useState<'catalog' | 'details' | 'install' | 'auth' | 'success'>('catalog');
  const [selectedPreset, setSelectedPreset] = React.useState<RuntimePreset | null>(null);
  const [selectedProfile, setSelectedProfile] = React.useState<BrainProfile | null>(null);
  const [runtimeGroups, setRuntimeGroups] = React.useState<RuntimeGroup[]>([]);
  const [runtimeStates, setRuntimeStates] = React.useState<Record<string, RuntimeStatus>>({});
  const [loadingRuntimes, setLoadingRuntimes] = React.useState(false);
  const [installSessionId, setInstallSessionId] = React.useState<string | null>(null);
  const [authSessionId, setAuthSessionId] = React.useState<string | null>(null);
  const [integrationStep, setIntegrationStep] = React.useState(-1);
  const [integrationEvents, setIntegrationEvents] = React.useState<any[]>([]);
  const [trustedRuntimes, setTrustedRuntimes] = React.useState<Set<string>>(new Set());

  const loadRuntimes = async () => {
    try {
      setLoadingRuntimes(true);
      const response = await fetch('http://localhost:3004/v1/brain/runtimes');
      if (response.ok) {
        const data = await response.json();
        if (data.groups && data.groups.length > 0) {
          setRuntimeGroups(data.groups);
        } else {
          console.warn('[BrainRuntimeTab] No runtime groups received from API');
          setRuntimeGroups([]);
        }
      } else {
        console.error('[BrainRuntimeTab] API error loading runtimes:', response.status);
        setRuntimeGroups([]);
      }
    } catch (err) {
      console.error('[BrainRuntimeTab] Failed to load runtimes:', err);
      setRuntimeGroups([]);
    } finally {
      setLoadingRuntimes(false);
    }
  };

  const handleViewDetails = (preset: RuntimePreset) => {
    setSelectedPreset(preset);
    setView('details');
  };
  
  const handleLaunch = async (profile: BrainProfile) => {
    try {
      await createSession(profile.config);
      onClose();
      setView('catalog');
    } catch (err) {
      alert('Failed to launch neural runtime. Check kernel logs.');
    }
  };
  
  const getRuntimeStatus = (presetId: string): RuntimeStatus => {
    const profile = profiles.find(p => p.config.id === presetId);
    
    if (!profile) {
      return 'not_installed';
    }
    
    const state = runtimeStates[presetId];
    if (state) {
      return state;
    }
    
    const preset = runtimeGroups.flatMap(g => g.runtimes).find(p => p.id === presetId);
    if (!preset) {
      return 'error';
    }
    
    if (preset.auth_required) {
      return 'auth_required';
    }
    
    return 'ready';
  };
  
  const getPrimaryAction = (preset: RuntimePreset): { label: string; action: () => void } => {
    const status = getRuntimeStatus(preset.id);
    
    switch (status) {
    case 'not_installed':
      return {
        label: 'Install',
        action: () => {
          handleInstall(preset);
        },
      };
    case 'auth_required':
      return {
        label: 'Authenticate',
        action: () => {
          handleAuth(preset);
        },
      };
    case 'ready':
      return {
        label: 'Launch',
        action: () => {
          const profile = profiles.find(p => p.config.id === preset.id);
          if (profile) {
            handleLaunchWithTrust(preset, profile);
          }
        },
      };
      default:
        return {
          label: 'Setup',
          action: () => {
            setSelectedPreset(preset);
            setView('details');
          },
        };
    }
  };
  
  const handleInstall = async (preset: RuntimePreset) => {
    try {
      setSelectedPreset(preset);
      setView('install');
      
      const res = await fetch('http://localhost:3004/v1/brain/runtimes/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_id: preset.id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setInstallSessionId(data.session_id);
        setRuntimeStates(prev => ({ ...prev, [preset.id]: 'installed' }));
        
        await startInstallStream(data.session_id);
      }
    } catch (err) {
      console.error('Install failed:', err);
      alert('Failed to install runtime. Check kernel logs.');
    }
  };
  
  const handleAuth = async (preset: RuntimePreset) => {
    try {
      setSelectedPreset(preset);
      setView('auth');
      
      const res = await fetch('http://localhost:3004/v1/brain/runtimes/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_id: preset.id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAuthSessionId(data.session_id);
        
        await startInstallStream(data.session_id);
      }
    } catch (err) {
      console.error('Auth failed:', err);
      alert('Failed to authenticate. Check kernel logs.');
    }
  };
  
  const handleVerify = async (preset: RuntimePreset) => {
    try {
      const res = await fetch('http://localhost:3004/v1/brain/runtimes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_id: preset.id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.installed) {
          setRuntimeStates(prev => ({ ...prev, [preset.id]: 'installed' }));
        }
      }
    } catch (err) {
      console.error('Verify failed:', err);
    }
  };
  
  const integrationEventSourceRef = React.useRef<EventSource | null>(null);
  
  const startInstallStream = (sessionId: string) => {
    if (integrationEventSourceRef.current) {
      integrationEventSourceRef.current.close();
    }
    
    console.log('[BrainRuntimeTab] Starting install stream for session:', sessionId);
    const es = new EventSource(`http://localhost:3004/v1/brain/runtimes/${sessionId}/events`);
    integrationEventSourceRef.current = es;
    setIntegrationStep(-1);
    setIntegrationEvents([]);
    
    es.onopen = () => {
      console.log('[BrainRuntimeTab] Install stream connected');
    };
    
    es.onmessage = (event) => {
      try {
        const brainEvent = JSON.parse(event.data);
        console.log('[BrainRuntimeTab] Install event:', brainEvent.type);
        setIntegrationEvents(prev => [...prev, brainEvent]);
        
        const stepIndex = EVENT_TO_STEP[brainEvent.type];
        if (stepIndex !== undefined) {
          setIntegrationStep(stepIndex);
        }
        
        if (brainEvent.type === 'integration.complete') {
          const preset = selectedPreset;
          if (preset && preset.auth_required) {
            setRuntimeStates(prev => ({ ...prev, [preset.id]: 'ready' }));
          }
          
          setTimeout(() => {
            setView('success');
            setIntegrationStep(INSTALL_STEPS.length - 1);
          }, 1000);
        }
      } catch (err) {
        console.error('[BrainRuntimeTab] Failed to parse event:', err);
      }
    };
    
    es.onerror = (err) => {
      console.error('[BrainRuntimeTab] Install stream error:', err);
    };
  };
  
  const sendInstallInput = async (input: string) => {
    if (!installSessionId) return;
    
    try {
      await fetch(`http://localhost:3004/v1/sessions/${installSessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch (err) {
      console.error('Failed to send install input:', err);
    }
  };
  
  React.useEffect(() => {
    return () => {
      if (integrationEventSourceRef.current) {
        integrationEventSourceRef.current.close();
        integrationEventSourceRef.current = null;
      }
    };
  }, []);
  
  React.useEffect(() => {
    if (!isOpen) {
      if (integrationEventSourceRef.current) {
        integrationEventSourceRef.current.close();
        integrationEventSourceRef.current = null;
      }
      setInstallSessionId(null);
      setAuthSessionId(null);
      setIntegrationEvents([]);
      setIntegrationStep(-1);
      setView('catalog');
      setSelectedPreset(null);
    }
  }, [isOpen]);
  
  React.useEffect(() => {
    if (view === 'success') {
      refreshProfiles();
    }
  }, [view, refreshProfiles]);
  
  React.useEffect(() => {
    if (isOpen) {
      loadRuntimes();
    }
  }, [isOpen]);

  React.useEffect(() => {
    const stored = localStorage.getItem('trustedRuntimes');
    if (stored) {
      setTrustedRuntimes(new Set(JSON.parse(stored)));
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem('trustedRuntimes', JSON.stringify([...trustedRuntimes]));
  }, [trustedRuntimes]);

  const getActiveSessionCount = (runtimeId: string) => {
    return profiles.filter(p => p.config.id === runtimeId && activeSession?.brain_id === runtimeId).length;
  };

  const handleLaunchWithTrust = (runtime: RuntimePreset, profile: BrainProfile) => {
    if (!trustedRuntimes.has(runtime.id) && runtime.runtime_type === 'cli') {
      if (!confirm(
        `This agent will run local commands on your machine.\n\n` +
        `Runtime: ${runtime.name}\n` +
        `Command: ${runtime.run_cmd}\n\n` +
        `Do you trust this runtime?`
      )) {
        return;
      }
      setTrustedRuntimes(new Set([...trustedRuntimes, runtime.id]));
    }

    handleLaunch(profile);
  };
  
  if (!isOpen) return null;

  return (
    <div className="brain-runtime-overlay">
      <div className="brain-runtime-backdrop" onClick={onClose} />
      <div className="brain-runtime-drawer" onClick={e => e.stopPropagation()}>
        <div className="brain-runtime-header">
          <h2>
            {view === 'catalog' && 'Agent Runtimes'}
            {view === 'details' && selectedPreset && `${selectedPreset.name}`}
            {view === 'install' && 'Install Runtime'}
            {view === 'auth' && 'Authenticate Runtime'}
            {view === 'success' && selectedPreset && 'Ready to Launch'}
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>


        <div className="brain-manager-body">
          {view === 'catalog' && (
              <>
                {loadingRuntimes ? (
                  <div className="loading-spinner">Loading runtimes...</div>
                ) : (
                  <>
                    {runtimeGroups.length === 0 && (
                      <div className="no-runtimes-message">
                        <div className="no-runtimes-icon">⚠️</div>
                        <div className="no-runtimes-content">
                          <h3>No runtimes available</h3>
                          <p>The kernel service may not be running or the API endpoint is not responding.</p>
                          <div className="no-runtimes-actions">
                            <button className="btn btn-primary" onClick={loadRuntimes}>Retry</button>
                            <button className="btn btn-secondary" onClick={() => window.open('http://localhost:3004/health', '_blank')}>Check Kernel Status</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {runtimeGroups.map(group => (
                      <RuntimeSection
                        key={group.title}
                        title={group.title}
                        runtimes={group.runtimes}
                        sessions={profiles}
                        onSelect={handleViewDetails}
                      />
                    ))}
                  </>
                )}
              </>
          )}

          {view === 'details' && selectedPreset && (
            <RuntimeDetailsView 
              preset={selectedPreset}
              profile={profiles.find(p => p.config.id === selectedPreset.id)}
              onLaunch={() => {
                const profile = profiles.find(p => p.config.id === selectedPreset.id);
                if (profile) handleLaunch(profile);
              }}
              onInstall={handleInstall}
              onAuth={handleAuth}
              onVerify={handleVerify}
              onBack={() => setView('catalog')}
            />
          )}

          {(view === 'install' || view === 'auth') && selectedPreset && (
            <InstallAuthView 
              preset={selectedPreset}
              mode={view === 'install' ? 'install' : 'auth'}
              sessionId={view === 'install' ? installSessionId : authSessionId}
              integrationEvents={integrationEvents}
              onSendInput={sendInstallInput}
              onCancel={() => {
                if (integrationEventSourceRef.current) {
                  integrationEventSourceRef.current.close();
                }
                setView('details');
              }}
              onComplete={() => {
                if (integrationEventSourceRef.current) {
                  integrationEventSourceRef.current.close();
                }
                setView('details');
              }}
            />
          )}

          {view === 'success' && selectedPreset && (
            <SuccessView 
              preset={selectedPreset}
              onLaunch={() => {
                const profile = profiles.find(p => p.config.id === selectedPreset.id);
                if (profile) handleLaunch(profile);
              }}
              onDone={() => setView('catalog')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface RuntimeSectionProps {
  title: string;
  runtimes: RuntimePreset[];
  sessions: BrainProfile[];
  onSelect: (preset: RuntimePreset) => void;
}

const RuntimeSection: React.FC<RuntimeSectionProps> = ({ title, runtimes, sessions, onSelect }) => {
  return (
    <div className="runtime-section">
      <div className="section-title">{title}</div>
      <div className="runtime-grid">
        {runtimes.map(preset => (
          <RuntimeTile
            key={preset.id}
            preset={preset}
            sessions={sessions}
            onClick={() => onSelect(preset)}
          />
        ))}
      </div>
    </div>
  );
};

interface RuntimeTileProps {
  preset: RuntimePreset;
  sessions: BrainProfile[];
  onClick: () => void;
}

const RuntimeTile: React.FC<RuntimeTileProps> = ({ preset, sessions, onClick }) => {
  const { activeSession } = useBrain();

  const profile = sessions.find(p => p.config.id === preset.id);
  const isActive = activeSession?.brain_id === preset.id;
  const activeSessionCount = sessions.filter(s => s.config.id === preset.id && activeSession?.brain_id === preset.id).length;

  let status: RuntimeStatus = 'not_installed';
  if (profile) {
    if (preset.auth_required) {
      status = 'auth_required';
    } else {
      status = 'ready';
    }
  } else {
    status = 'not_installed';
  }
  
  if (activeSession?.brain_id === preset.id) {
    status = 'running';
  }
  
  return (
    <div 
      className={`runtime-tile ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="runtime-tile-header">
        <img
          src={`/assets/runtime-logos/${preset.logo_asset}`}
          alt={preset.name}
          className="runtime-logo"
        />
        <div className="runtime-tile-info">
          <div className="runtime-tile-name">{preset.name}</div>
          <div className="runtime-tile-vendor">{preset.vendor}</div>
        </div>
        {activeSessionCount > 0 && (
          <div className="session-indicator">
            <span className="session-dot"></span>
            <span className="session-count">{activeSessionCount}</span>
          </div>
        )}
        <div className={`execution-badge ${getExecutionBadge(preset.runtime_type)}`}>
          {getExecutionBadgeLabel(preset.runtime_type)}
        </div>
        <div className={`runtime-status ${getStatusStyle(status)}`}>
          {getStatusLabel(status)}
        </div>
      </div>
      <div className="runtime-tile-desc">{preset.description}</div>
    </div>
  );
};

interface RuntimeDetailsViewProps {
  preset: RuntimePreset;
  profile?: BrainProfile;
  onLaunch: () => void;
  onInstall: (preset: RuntimePreset) => void;
  onAuth: (preset: RuntimePreset) => void;
  onVerify: (preset: RuntimePreset) => void;
  onBack: () => void;
}

const RuntimeDetailsView: React.FC<RuntimeDetailsViewProps> = ({ 
  preset, 
  profile, 
  onLaunch, 
  onInstall, 
  onAuth, 
  onVerify, 
  onBack 
}) => {
  const { profiles } = useBrain();
  
  let status: RuntimeStatus = 'not_installed';
  if (profile) {
    if (preset.auth_required) {
      status = 'auth_required';
    } else {
      status = 'ready';
    }
  }
  
  return (
    <div className="runtime-details-view">
      <button className="back-btn" onClick={onBack}>← Back</button>
      
      <div className="details-header">
        <img 
          src={`/assets/runtime-logos/${preset.logo_asset}`} 
          alt={preset.name}
          className="details-logo"
        />
        <div className="details-info">
          <div className="details-name">{preset.name}</div>
          <div className="details-vendor">{preset.vendor}</div>
          <div className={`execution-badge ${getExecutionBadge(preset.runtime_type)}`}>
            {getExecutionBadgeLabel(preset.runtime_type)}
          </div>
          <div className={`details-status ${getStatusStyle(status)}`}>
            {getStatusLabel(status)}
          </div>
        </div>
      </div>
      
      <div className="details-content">
        <div className="details-section">
          <div className="section-title">Description</div>
          <div className="section-content">{preset.description}</div>
        </div>
        
        <div className="details-section">
          <div className="section-title">Capabilities</div>
          <div className="capability-tags">
            {preset.capabilities.map(cap => (
              <span key={cap} className="capability-tag">{cap}</span>
            ))}
          </div>
        </div>
        
        <div className="details-section">
          <div className="section-title">Execution Type</div>
          <div className={`execution-badge ${getExecutionBadge(preset.runtime_type)}`}>
            {getExecutionBadgeLabel(preset.runtime_type)}
          </div>
        </div>
        
        {profile && (
          <div className="details-section">
            <div className="section-title">Configuration</div>
            <div className="config-item">
              <span className="config-label">Command:</span>
              <span className="config-value">{profile.config.command || 'N/A'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Type:</span>
              <span className="config-value">{profile.config.brain_type}</span>
            </div>
            {profile.config.api_key_env && (
              <div className="config-item">
                <span className="config-label">API Key Env:</span>
                <span className="config-value config-redacted">••••••••••</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="details-actions">
        <button className="btn btn-secondary" onClick={() => onVerify(preset)}>
          Verify Installation
        </button>
        {preset.auth_required && status === 'auth_required' && (
          <button className="btn btn-secondary" onClick={() => onAuth(preset)}>
            Authenticate
          </button>
        )}
        {!profile && (
          <button className="btn btn-primary" onClick={() => onInstall(preset)}>
            Install
          </button>
        )}
        {status === 'ready' && (
          <button className="btn btn-primary" onClick={onLaunch}>
            Launch Session
          </button>
        )}
      </div>
    </div>
  );
};

interface InstallAuthViewProps {
  preset: RuntimePreset;
  mode: 'install' | 'auth';
  sessionId: string | null;
  integrationEvents: any[];
  onSendInput: (input: string) => void;
  onCancel: () => void;
  onComplete: () => void;
}

const InstallAuthView: React.FC<InstallAuthViewProps> = ({ 
  preset, 
  mode, 
  sessionId, 
  integrationEvents,
  onSendInput, 
  onCancel, 
  onComplete 
}) => {
  const [inputValue, setInputValue] = React.useState('');
  
  const title = mode === 'install' ? `Installing ${preset.name}` : `Authenticating ${preset.name}`;
  const description = mode === 'install' 
    ? `Running install command: ${preset.install_cmd || preset.run_cmd}` 
    : preset.auth_instructions || 'Follow the authentication flow in the terminal.';
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendInput(inputValue);
      setInputValue('');
    }
  };
  
  return (
    <div className="install-auth-view">
      <button className="back-btn" onClick={onCancel}>← Cancel</button>
      
      <div className="install-header">
        <img 
          src={`/assets/runtime-logos/${preset.logo_asset}`} 
          alt={preset.name}
          className="install-logo"
        />
        <div className="install-info">
          <div className="install-title">{title}</div>
          <div className="install-desc">{description}</div>
          {sessionId && (
            <div className="install-session">Session ID: {sessionId.substring(0, 8)}...</div>
          )}
        </div>
      </div>
      
      <div className="install-terminal">
        <div className="terminal-header">
          <span className="terminal-title">Terminal Output</span>
          {mode === 'auth' && (
            <button className="terminal-action" onClick={() => {
              onComplete();
            }}>
              I'm Done
            </button>
          )}
        </div>
        
        <div className="terminal-output">
          {integrationEvents.map((event: any, idx: number) => (
            <div key={idx} className="terminal-line">
              {event.type === 'terminal.delta' && event.payload?.data}
            </div>
          ))}
          {!integrationEvents.length && (
            <div className="terminal-line terminal-placeholder">
              {mode === 'install' ? 'Starting install process...' : 'Starting authentication...'}
            </div>
          )}
        </div>
        
        <form className="terminal-input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="terminal-input"
            placeholder={mode === 'auth' ? 'Enter credentials or confirm...' : 'Type command or respond...'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="terminal-send">Send</button>
        </form>
      </div>
    </div>
  );
};

interface SuccessViewProps {
  preset: RuntimePreset;
  onLaunch: () => void;
  onDone: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ preset, onLaunch, onDone }) => {
  return (
    <div className="success-view">
      <div className="success-icon-container">
        <img 
          src={`/assets/runtime-logos/${preset.logo_asset}`} 
          alt={preset.name}
          className="success-logo"
        />
        <div className="success-badge">✓</div>
      </div>
      <h3 className="success-title">{preset.name} Ready</h3>
      <p className="success-message">
        Runtime installed and configured successfully. You can now launch a session or manage additional runtimes.
      </p>
      <div className="success-actions">
        <button className="btn btn-secondary" onClick={onDone}>
          Done
        </button>
        <button className="btn btn-primary" onClick={onLaunch}>
          Launch Session
        </button>
      </div>
    </div>
  );
};




