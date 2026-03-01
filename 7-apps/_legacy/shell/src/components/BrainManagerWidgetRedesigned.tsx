import * as React from 'react';
import { useBrain, BrainProfile, BrainConfig, BrainType } from '../runtime/BrainContext';
import { useShellState } from '../runtime/ShellState';
import '../styles/brain-manager.css';

interface BrainManagerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

type RuntimeStatus = 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error';

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

export const BrainManagerWidget: React.FC<BrainManagerWidgetProps> = ({ isOpen, onClose }) => {
  const { profiles, activeSession, createSession, refreshProfiles } = useBrain();
  const { capsules, journalEvents } = useShellState();
  
  const [view, setView] = React.useState<'catalog' | 'add' | 'configure' | 'install' | 'auth' | 'details' | 'success'>('catalog');
  const [selectedPreset, setSelectedPreset] = React.useState<RuntimePreset | null>(null);
  const [selectedProfile, setSelectedProfile] = React.useState<BrainProfile | null>(null);
  const [configValues, setConfigValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isBrainActiveProvider, setIsBrainActiveProvider] = React.useState(false);
  const [runtimeStates, setRuntimeStates] = React.useState<Record<string, RuntimeStatus>>({});
  const [runtimeGroups, setRuntimeGroups] = React.useState<RuntimeGroup[]>([]);
  const [loadingRuntimes, setLoadingRuntimes] = React.useState(false);
  
  const [installSessionId, setInstallSessionId] = React.useState<string | null>(null);
  const [authSessionId, setAuthSessionId] = React.useState<string | null>(null);
  
  const loadRuntimes = async () => {
    try {
      setLoadingRuntimes(true);
      const response = await fetch('http://localhost:3004/v1/brain/runtimes');
      if (response.ok) {
        const data = await response.json();
        setRuntimeGroups(data.groups);
      }
    } catch (err) {
      console.error('[BrainManager] Failed to load runtimes:', err);
    } finally {
      setLoadingRuntimes(false);
    }
  };
  
  React.useEffect(() => {
    if (isOpen) {
      loadRuntimes();
    }
  }, [isOpen]);
  
  const handleViewDetails = (preset: RuntimePreset) => {
    setSelectedPreset(preset);
    setView('details');
  };
  
  const getStatusStyle = (status: 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error'): string => {
    const styles = {
      not_installed: 'status-not-installed',
      installed: 'status-installed',
      auth_required: 'status-auth-required',
      ready: 'status-ready',
      error: 'status-error',
    };
    return styles[status];
  };
  
  const getStatusLabel = (status: 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error'): string => {
    const labels = {
      not_installed: 'Not installed',
      installed: 'Installed',
      auth_required: 'Auth required',
      ready: 'Ready',
      error: 'Error',
    };
    return labels[status];
  };

  
  const integrationEventSourceRef = React.useRef<EventSource | null>(null);
  const [integrationEvents, setIntegrationEvents] = React.useState<any[]>([]);
  const [integrationStep, setIntegrationStep] = React.useState(-1);
  
  React.useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:3004/v1/config/model')
        .then(res => res.json())
        .then(data => {
          setIsBrainActiveProvider(data.provider === 'brain');
        })
        .catch(err => console.error('[BrainManager] Failed to fetch active provider:', err));
    }
  }, [isOpen]);
  
  const eventToStep: Record<string, number> = {
    'integration.profile.registered': 0,
    'integration.pty.initializing': 1,
    'integration.pty.ready': 2,
    'integration.dispatcher.connected': 3,
    'integration.tools.verified': 4,
    'integration.context.synced': 5,
    'integration.complete': 6,
  };
  
  const steps = [
    'Registering Profile',
    'Initializing PTY Runtime',
    'Connecting to Intent Dispatcher',
    'Verifying Tool Access',
    'Synchronizing Context',
    'Complete',
  ];

  const handleLaunch = async (profile: BrainProfile) => {
    try {
      await createSession(profile.config);
      onClose();
      setView('catalog');
    } catch (err) {
      alert('Failed to launch neural runtime. Check kernel logs.');
    }
  };
  
  const toggleBrainAsProvider = async () => {
    try {
      const nextState = !isBrainActiveProvider;
      const provider = nextState ? 'brain' : 'local';
      
      const res = await fetch('http://localhost:3004/v1/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model: 'default' }),
      });

      if (res.ok) {
        setIsBrainActiveProvider(nextState);
      }
    } catch (err) {
      alert('Failed to update system intelligence provider.');
    }
  };
  
  const getGroupedRuntimes = () => {
    const apiRuntimes = PRESET_RUNTIMES.filter(r => r.type === 'api');
    const localRuntimes = PRESET_RUNTIMES.filter(r => r.type === 'local');
    const cliRuntimes = PRESET_RUNTIMES.filter(r => r.type === 'cli');
    
    return {
      api: apiRuntimes,
      local: localRuntimes,
      cli: cliRuntimes,
    };
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
    
    const preset = PRESET_RUNTIMES.find(p => p.id === presetId);
    if (!preset) {
      return 'error';
    }
    
    if (preset.auth.required) {
      return 'auth_required';
    }
    
    return 'ready';
  };
  
  const getStatusLabel = (status: RuntimeStatus): string => {
    const labels: Record<RuntimeStatus, string> = {
      not_installed: 'Not installed',
      installed: 'Installed',
      auth_required: 'Auth required',
      ready: 'Ready',
      error: 'Error',
    };
    return labels[status];
  };
  
  const getStatusStyle = (status: RuntimeStatus): string => {
    const styles: Record<RuntimeStatus, string> = {
      not_installed: 'status-not-installed',
      installed: 'status-installed',
      auth_required: 'status-auth-required',
      ready: 'status-ready',
      error: 'status-error',
    };
    return styles[status];
  };
  
  const getPrimaryAction = (preset: RuntimePreset): { label: string; action: () => void } => {
    const status = getRuntimeStatus(preset.id);
    
    switch (status) {
      case 'not_installed':
        return {
          label: 'Install',
          action: () => handleInstall(preset),
        };
      case 'auth_required':
        return {
          label: 'Authenticate',
          action: () => handleAuth(preset),
        };
      case 'ready':
        return {
          label: 'Launch',
          action: () => {
            const profile = profiles.find(p => p.config.id === preset.id);
            if (profile) {
              handleLaunch(profile);
            }
          },
        };
      default:
        return {
          label: 'Setup',
          action: () => {
            setSelectedPreset(preset);
            setView('configure');
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
  
  const startInstallStream = (sessionId: string) => {
    if (integrationEventSourceRef.current) {
      integrationEventSourceRef.current.close();
    }
    
    console.log('[BrainManager] Starting install stream for session:', sessionId);
    const es = new EventSource(`http://localhost:3004/v1/brain/runtimes/${sessionId}/events`);
    integrationEventSourceRef.current = es;
    setIntegrationStep(-1);
    setIntegrationEvents([]);
    
    es.onopen = () => {
      console.log('[BrainManager] Install stream connected');
    };
    
    es.onmessage = (event) => {
      try {
        const brainEvent = JSON.parse(event.data);
        console.log('[BrainManager] Install event:', brainEvent.type);
        setIntegrationEvents(prev => [...prev, brainEvent]);
        
        const stepIndex = eventToStep[brainEvent.type];
        if (stepIndex !== undefined) {
          setIntegrationStep(stepIndex);
        }
        
        if (brainEvent.type === 'integration.complete') {
          const preset = PRESET_RUNTIMES.find(p => p.id === selectedPreset?.id);
          if (preset && preset.auth.required) {
            setRuntimeStates(prev => ({ ...prev, [preset.id]: 'ready' }));
          }
          
          setTimeout(() => {
            setView('success');
            setIntegrationStep(6);
          }, 1000);
        }
      } catch (err) {
        console.error('[BrainManager] Failed to parse event:', err);
      }
    };
    
    es.onerror = (err) => {
      console.error('[BrainManager] Install stream error:', err);
    };
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
      setErrors({});
      setConfigValues({});
    }
  }, [isOpen]);
  
  React.useEffect(() => {
    if (view === 'success') {
      refreshProfiles();
    }
  }, [view, refreshProfiles]);
  
  if (!isOpen) return null;

  const groupedRuntimes = getGroupedRuntimes();

  return (
    <div className="brain-manager-overlay">
      <div className="brain-manager-backdrop" onClick={onClose} />
      <div className="brain-manager-drawer" onClick={e => e.stopPropagation()}>
        <div className="brain-manager-header">
          <h2>
            {view === 'catalog' ? 'Runtime Catalog' :
             view === 'add' ? 'Add Runtime' :
             view === 'install' || view === 'auth' ? 'Installing...' :
             view === 'details' ? 'Runtime Details' :
             view === 'success' ? 'Ready' :
             'Configure Runtime'}
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="brain-manager-body">
          {view === 'catalog' && (
            <>
              <div className="ops-overview">
                <div className="stat-card">
                  <span className="stat-val">{capsules.length}</span>
                  <span className="stat-lab">Capsules</span>
                </div>
                <div className="stat-card">
                  <span className="stat-val">{journalEvents.length}</span>
                  <span className="stat-lab">Events</span>
                </div>
              </div>

              <div className="provider-control">
                <button 
                  className={`toggle-btn ${isBrainActiveProvider ? 'active' : ''}`}
                  onClick={toggleBrainAsProvider}
                >
                  <span className="toggle-icon">{isBrainActiveProvider ? '🧠' : '🤖'}</span>
                  <span>{isBrainActiveProvider ? 'Neural Dispatch Active' : 'Enable Neural Dispatch'}</span>
                </button>
              </div>

              <RuntimeSection title="API Runtimes" runtimes={groupedRuntimes.api} onSelect={handleViewDetails} />
              <RuntimeSection title="Local Runtimes" runtimes={groupedRuntimes.local} onSelect={handleViewDetails} />
              <RuntimeSection title="CLI-Wrapped Runtimes" runtimes={groupedRuntimes.cli} onSelect={handleViewDetails} />
            </>
          )}

          {view === 'add' && (
            <AddRuntimeView 
              presets={PRESET_RUNTIMES} 
              onSelect={setSelectedPreset}
              onBack={() => setView('catalog')}
            />
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
  onSelect: (preset: RuntimePreset) => void;
}

const RuntimeSection: React.FC<RuntimeSectionProps> = ({ title, runtimes, onSelect }) => {
  return (
    <div className="runtime-section">
      <div className="section-title">{title}</div>
      <div className="runtime-grid">
        {runtimes.map(preset => (
          <RuntimeTile 
            key={preset.id}
            preset={preset}
            onClick={() => onSelect(preset)}
          />
        ))}
      </div>
    </div>
  );
};

interface RuntimeTileProps {
  preset: RuntimePreset;
  onClick: () => void;
}

const RuntimeTile: React.FC<RuntimeTileProps> = ({ preset, onClick }) => {
  const { profiles, activeSession } = useBrain();
  
  const profile = profiles.find(p => p.config.id === preset.id);
  const isActive = activeSession?.brain_id === preset.id;
  
  let status: 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error' = 'not_installed';
  if (profile) {
    if (preset.auth.required) {
      status = 'auth_required';
    } else {
      status = 'ready';
    }
  } else {
    status = 'not_installed';
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
        <div className={`runtime-status ${getStatusStyle(status)}`}>
          {getStatusLabel(status)}
        </div>
      </div>
      <div className="runtime-tile-desc">{preset.description}</div>
      <div className="runtime-tile-actions">
        {profile && preset.auth.required && (
          <button className="runtime-action-btn runtime-action-secondary">View Config</button>
        )}
      </div>
    </div>
  );
};

const AddRuntimeView: React.FC<{
  presets: RuntimePreset[];
  onSelect: (preset: RuntimePreset) => void;
  onBack: () => void;
}> = ({ presets, onSelect, onBack }) => {
  const [source, setSource] = React.useState<'preset' | 'import' | 'custom'>('preset');
  
  const grouped = {
    preset: presets.filter(p => p.type === 'cli' || p.type === 'local'),
    api: presets.filter(p => p.type === 'api'),
  };
  
  return (
    <div className="add-runtime-view">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="section-title">Choose Source</div>
      
      <div className="source-selector">
        <button 
          className={`source-option ${source === 'preset' ? 'active' : ''}`}
          onClick={() => setSource('preset')}
        >
          <div className="source-icon">📦</div>
          <div>
            <div className="source-title">Built-in Presets</div>
            <div className="source-desc">Recommended CLI agents and API providers</div>
          </div>
        </button>
        
        <button 
          className={`source-option ${source === 'import' ? 'active' : ''}`}
          onClick={() => setSource('import')}
        >
          <div className="source-icon">📥</div>
          <div>
            <div className="source-title">Import Config</div>
            <div className="source-desc">Paste JSON or load config file</div>
          </div>
        </button>
        
        <button 
          className={`source-option ${source === 'custom' ? 'active' : ''}`}
          onClick={() => setSource('custom')}
        >
          <div className="source-icon">⚙️</div>
          <div>
            <div className="source-title">Custom Runtime</div>
            <div className="source-desc">Manually configure command and args</div>
          </div>
        </button>
      </div>
      
      {source === 'preset' && (
        <div className="preset-grid">
          {grouped.preset.map(preset => (
            <div 
              key={preset.id}
              className="preset-option"
              onClick={() => onSelect(preset)}
            >
              <img 
                src={`/assets/runtime-logos/${preset.logo_asset}`} 
                alt={preset.name}
                className="preset-logo"
              />
              <div className="preset-info">
                <div className="preset-name">{preset.name}</div>
                <div className="preset-vendor">{preset.vendor}</div>
                <div className="preset-desc">{preset.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface RuntimeDetailsViewProps {
  preset: RuntimePreset;
  profile?: BrainProfile;
  onLaunch: () => void;
  onInstall: () => void;
  onAuth: () => void;
  onVerify: () => void;
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
  
  let status: 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error' = 'not_installed';
  if (profile) {
    if (preset.auth.required) {
      status = 'auth_required';
    } else {
      status = 'ready';
    }
  }
  
  const primaryAction = getPrimaryActionForPreset(preset, status);
  
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
        <button className="btn btn-secondary" onClick={onVerify}>
          Verify Installation
        </button>
        {preset.auth.required && status === 'auth_required' && (
          <button className="btn btn-secondary" onClick={onAuth}>
            Authenticate
          </button>
        )}
        {!profile && (
          <button className="btn btn-primary" onClick={onInstall}>
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
  onSendInput: (input: string) => void;
  onCancel: () => void;
  onComplete: () => void;
}

const InstallAuthView: React.FC<InstallAuthViewProps> = ({ 
  preset, 
  mode, 
  sessionId, 
  onSendInput, 
  onCancel, 
  onComplete 
}) => {
  const [inputValue, setInputValue] = React.useState('');
  const [events, setEvents] = React.useState<any[]>([]);
  
  const title = mode === 'install' ? `Installing ${preset.name}` : `Authenticating ${preset.name}`;
  const description = mode === 'install' 
    ? `Running install command: ${preset.id}` 
    : preset.id === 'claude-code' || preset.id === 'aider' || preset.id === 'goose'
      ? 'First run will prompt for API key. Enter your credentials when prompted.'
      : 'Follow the authentication flow in the terminal.';
  
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
          {events.map((event, idx) => (
            <div key={idx} className="terminal-line">
              {event.type === 'terminal.delta' && event.payload.data}
            </div>
          ))}
          {!events.length && (
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

function getPrimaryActionForPreset(preset: RuntimePreset, status: 'not_installed' | 'installed' | 'auth_required' | 'ready' | 'error'): {
  label: string;
  action: () => void;
} {
  switch (status) {
    case 'not_installed':
      return {
        label: 'Install',
        action: () => {},
      };
    case 'auth_required':
      return {
        label: 'Authenticate',
        action: () => {},
      };
    case 'ready':
      return {
        label: 'Launch',
        action: () => {},
      };
    default:
      return {
        label: 'Setup',
        action: () => {},
      };
  }
}
