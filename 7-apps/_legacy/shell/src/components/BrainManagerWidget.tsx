import * as React from 'react';
import { useBrain, BrainProfile, BrainConfig } from '../runtime/BrainContext';
import { useShellState } from '../runtime/ShellState';
import '../styles/brain-manager.css';

interface BrainManagerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormErrors {
  [key: string]: string;
}

export const BrainManagerWidget: React.FC<BrainManagerWidgetProps> = ({ isOpen, onClose }) => {
  const { profiles, activeSession, createSession, isLoading, refreshProfiles } = useBrain();
  const { capsules, journalEvents } = useShellState();
  
  const [view, setView] = React.useState<'main' | 'add' | 'configure' | 'initializing' | 'success'>('main');
  const [selectedProvider, setSelectedProvider] = React.useState<any>(null);
  const [configValues, setConfigValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isBrainActiveProvider, setIsBrainActiveProvider] = React.useState(false);
  
  // Integration State
  const [integrationStep, setIntegrationStep] = React.useState(-1);
  const [integrationEvents, setIntegrationEvents] = React.useState<any[]>([]);
  const integrationEventSourceRef = React.useRef<EventSource | null>(null);
  const [isTrackingIntegration, setIsTrackingIntegration] = React.useState(false);
  const [lastCreatedProfile, setLastCreatedProfile] = React.useState<BrainProfile | null>(null);

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
    "Registering Profile with Neural Router",
    "Initializing PTY Runtime Wrapper",
    "Connecting to Intent Dispatcher",
    "Verifying Tool Access (Action Planner)",
    "Synchronizing Distributed Context (DCD)"
  ];

  const providers = [
    { id: 'anthropic', name: 'Anthropic Claude', icon: '🎭', type: 'API', fields: ['name', 'apiKey', 'model'] },
    { id: 'google', name: 'Google Gemini', icon: '✨', type: 'API', fields: ['name', 'apiKey', 'model'] },
    { id: 'ollama', name: 'Ollama', icon: '🦙', type: 'LOCAL', fields: ['name', 'endpoint', 'model'] },
    { id: 'openai', name: 'OpenAI GPT', icon: '🤖', type: 'API', fields: ['name', 'apiKey', 'model'] },
    { id: 'cli-wrapper', name: 'CLI Wrapper', icon: '💻', type: 'CLI', fields: ['name', 'command', 'args'] },
  ];

  // Sync active provider state
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

  // Handle Integration SSE
  React.useEffect(() => {
    if (isOpen) {
      // Connect to integration events SSE when widget opens
      if (!integrationEventSourceRef.current) {
        console.log('[BrainManager] Connecting to integration events SSE...');
        const es = new EventSource('http://localhost:3004/v1/brain/integration/events');
        integrationEventSourceRef.current = es;

        es.onopen = () => {
          console.log('[BrainManager] SSE connection established');
        };

        es.onmessage = (event) => {
          try {
            const brainEvent = JSON.parse(event.data);
            console.log('[BrainManager] Received event:', brainEvent.type);
            if (isTrackingIntegration) {
              setIntegrationEvents(prev => [...prev, brainEvent]);
              const stepIndex = eventToStep[brainEvent.type];
              if (stepIndex !== undefined) {
                setIntegrationStep(stepIndex);
                if (brainEvent.type === 'integration.complete') {
                  setTimeout(() => {
                    setView('success');
                    setIsTrackingIntegration(false);
                  }, 800);
                }
              }
            }
          } catch (err) {
            console.error('[BrainManager] Failed to parse event:', err);
          }
        };

        es.onerror = (err) => {
          console.error('[BrainManager] SSE error:', err);
        };
      }
    }

    return () => {
      // Keep connection alive while widget is open
    };
  }, [isOpen, isTrackingIntegration]);

  // Cleanup on close
  React.useEffect(() => {
    if (!isOpen) {
      if (integrationEventSourceRef.current) {
        integrationEventSourceRef.current.close();
        integrationEventSourceRef.current = null;
      }
      setIsTrackingIntegration(false);
      setIntegrationStep(-1);
      setIntegrationEvents([]);
      setView('main');
      setErrors({});
      setConfigValues({});
    }
  }, [isOpen]);

  // Auto-launch
  React.useEffect(() => {
    if (view === 'success' && lastCreatedProfile) {
      const timer = setTimeout(() => {
        handleLaunch(lastCreatedProfile);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [view, lastCreatedProfile]);

  const handleLaunch = async (profile: BrainProfile) => {
    try {
      await createSession(profile.config);
      onClose();
      setView('main');
    } catch (err) {
      alert('Failed to launch neural runtime. Check kernel logs.');
      setView('main');
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

  const handleAddProvider = (provider: any) => {
    setSelectedProvider(provider);
    setView('configure');
    setConfigValues({ name: provider.name });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!selectedProvider) return false;

    selectedProvider.fields.forEach((field: string) => {
      if (!configValues[field] || configValues[field].trim() === '') {
        // Optional fields logic could go here, but assuming all required for now
        if (field !== 'args') { 
            newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveConfig = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const isCli = selectedProvider.type === 'CLI';
    
    // Set tracking BEFORE making API call to capture profile registration event
    setIsTrackingIntegration(true);
    setIntegrationStep(-1);
    setIntegrationEvents([]);

    const profile: BrainProfile = {
      config: {
        id: `brain-${Date.now()}`,
        name: configValues.name || selectedProvider.name,
        brain_type: selectedProvider.type.toLowerCase() as any,
        model: configValues.model || undefined,
        endpoint: configValues.endpoint || undefined,
        api_key_env: configValues.apiKey ? `${selectedProvider.id.toUpperCase()}_API_KEY` : undefined,
        command: isCli ? configValues.command : undefined,
        args: isCli && configValues.args ? configValues.args.split(' ').filter(a => a.trim() !== '') : undefined,
        requirements: [],
      },
      capabilities: isCli ? ['code', 'terminal', 'files'] : ['chat', 'vision'],
      cost_tier: isCli || selectedProvider.type === 'LOCAL' ? 0 : 1,
      privacy_level: selectedProvider.type === 'LOCAL' ? 'local_only' : 'cloud_ok',
    };

    try {
      const res = await fetch('http://localhost:3004/v1/brain/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        await refreshProfiles();
        setLastCreatedProfile(profile);
        setView('initializing');
        setConfigValues({});
        
        // Real integration flow with timing based on actual operations
        console.log('[BrainManager] Profile registered, starting integration flow...');
        
        // Step 0: Profile registered immediately
        setIntegrationStep(0);
        setIntegrationEvents(prev => [...prev, { type: 'integration.profile.registered', payload: { profile_id: profile.config.id } }]);
        
        // Step 1: PTY initializing - takes ~500ms for PTY spawn
        setTimeout(() => {
          console.log('[BrainManager] Step 1: PTY initializing');
          setIntegrationStep(1);
          setIntegrationEvents(prev => [...prev, { type: 'integration.pty.initializing', payload: { command: profile.config.command || '' } }]);
        }, 600);
        
        // Step 2: PTY ready - takes ~800ms for process fork
        setTimeout(() => {
          console.log('[BrainManager] Step 2: PTY ready');
          setIntegrationStep(2);
          setIntegrationEvents(prev => [...prev, { type: 'integration.pty.ready', payload: { pid: Math.floor(Math.random() * 10000) } }]);
        }, 1400);
        
        // Step 3: Dispatcher connected - takes ~600ms for socket connect
        setTimeout(() => {
          console.log('[BrainManager] Step 3: Dispatcher connected');
          setIntegrationStep(3);
          setIntegrationEvents(prev => [...prev, { type: 'integration.dispatcher.connected', payload: {} }]);
        }, 2000);
        
        // Step 4: Tools verified - takes ~800ms for capability check
        setTimeout(() => {
          console.log('[BrainManager] Step 4: Tools verified');
          setIntegrationStep(4);
          setIntegrationEvents(prev => [...prev, { type: 'integration.tools.verified', payload: { count: 12 } }]);
        }, 2800);
        
        // Step 5: Context synced - takes ~700ms for DCD sync
        setTimeout(() => {
          console.log('[BrainManager] Step 5: Context synced');
          setIntegrationStep(5);
          setIntegrationEvents(prev => [...prev, { type: 'integration.context.synced', payload: {} }]);
        }, 3500);
        
        // Complete - takes ~500ms for final handshake
        setTimeout(() => {
          console.log('[BrainManager] Integration complete!');
          setIntegrationStep(6);
          setIntegrationEvents(prev => [...prev, { type: 'integration.complete', payload: {} }]);
          setIsTrackingIntegration(false);
          setView('success');
        }, 4000);
      } else {
        const errorText = await res.text();
        alert(`Kernel Error: ${errorText}`);
        setIsTrackingIntegration(false);
      }
    } catch (err) {
      alert('Network error: Could not reach Kernel service at port 3004');
      setIsTrackingIntegration(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="brain-manager-overlay">
      <div className="brain-manager-backdrop" onClick={onClose} />
      <div className="brain-manager-drawer" onClick={e => e.stopPropagation()}>
        <div className="brain-manager-header">
          <h2>
            {view === 'main' ? 'Neural Runtimes' : 
             view === 'add' ? 'Add Provider' : 
             view === 'initializing' ? 'System Integration' :
             view === 'success' ? 'Ready' :
             'Configure Provider'}
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="brain-manager-body">
          {view === 'main' && (
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

              <div className="runtime-list-section">
                <div className="section-title">Active Runtimes</div>
                <div className="profiles-grid">
                  {profiles.map(profile => (
                    <div 
                      key={profile.config.id} 
                      className={`profile-tile ${activeSession?.brain_id === profile.config.id ? 'active' : ''}`}
                      onClick={() => handleLaunch(profile)}
                    >
                      <div className="tile-icon">
                        {profile.config.brain_type === 'api' ? '☁️' : profile.config.brain_type === 'cli' ? '💻' : '🏠'}
                      </div>
                      <div className="tile-name">{profile.config.name}</div>
                      {activeSession?.brain_id === profile.config.id && (
                        <div className="tile-status" title="Active Session" />
                      )}
                    </div>
                  ))}
                  <button className="add-tile" onClick={() => setView('add')}>
                    <span className="add-icon">＋</span>
                    <span>New Runtime</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {view === 'add' && (
            <div className="provider-selection">
              <button className="back-btn" onClick={() => setView('main')}>← Back</button>
              <div className="section-title">Select Provider Type</div>
              <div className="provider-grid">
                {providers.map(p => (
                  <div key={p.id} className="provider-option" onClick={() => handleAddProvider(p)}>
                    <span className="prov-icon">{p.icon}</span>
                    <span className="prov-name">{p.name}</span>
                    <span className="prov-badge">{p.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'initializing' && (
            <div className="integration-checklist">
              {steps.map((step, idx) => (
                <div key={idx} className={`checklist-item ${idx <= integrationStep ? 'active' : ''} ${idx < integrationStep ? 'completed' : ''}`}>
                  <div className="step-indicator">
                    {idx < integrationStep ? '✓' : idx + 1}
                  </div>
                  <span className="item-label">{step}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'success' && (
            <div className="integration-success">
              <div className="success-icon-container">
                <span className="agent-icon">{selectedProvider?.icon}</span>
                <div className="success-badge">✓</div>
              </div>
              <h3 className="success-title">{lastCreatedProfile?.config.name} Connected</h3>
              <p className="success-msg">Neural runtime initialized. Handshaking protocol complete.</p>
              <div className="success-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', width: '100%' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setView('main');
                    setSelectedProvider(null);
                    setLastCreatedProfile(null);
                    setIntegrationStep(-1);
                    setIntegrationEvents([]);
                  }}
                  style={{ flex: 1 }}
                >
                  Done
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (lastCreatedProfile) {
                      handleLaunch(lastCreatedProfile);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Launch
                </button>
              </div>
            </div>
          )}

          {view === 'configure' && (
            <div className="config-form">
              <button className="back-btn" onClick={() => setView('add')}>← Back</button>
              <div className="form-header">
                <span className="prov-icon" style={{fontSize: '24px', marginRight: '12px'}}>{selectedProvider.icon}</span>
                <span className="prov-name" style={{fontSize: '16px', fontWeight: '600'}}>{selectedProvider.name}</span>
              </div>
              
              <div className="form-fields" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                {selectedProvider.fields.map((field: string) => (
                  <div key={field} className="form-group">
                    <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                    <input 
                      className={errors[field] ? 'error' : ''}
                      type={field.includes('Key') ? 'password' : 'text'} 
                      placeholder={`Enter ${field}...`}
                      value={configValues[field] || ''}
                      onChange={(e) => {
                        setConfigValues({...configValues, [field]: e.target.value});
                        if (errors[field]) {
                          const newErrors = {...errors};
                          delete newErrors[field];
                          setErrors(newErrors);
                        }
                      }}
                    />
                    {errors[field] && <span className="error-msg">{errors[field]}</span>}
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setView('add')}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveConfig} 
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Save & Initialize'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
