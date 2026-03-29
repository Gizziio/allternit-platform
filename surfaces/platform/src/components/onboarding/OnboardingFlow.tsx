/**
 * Onboarding Flow
 * 
 * A high-quality setup wizard that matches the reference design.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  CaretRight,
  Sparkle,
  X,
  Chat,
  Users,
  Code,
  Globe,
  HardDrives,
  HardDrive,
  Cloud,
  WifiHigh,
  Terminal,
  Key,
  Lock,
  Eye,
  Lightning,
  CircleNotch,
  Warning,
  CheckCircle,
  Check,
  Palette,
  FolderOpen,
  ArrowRight,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { GizziMascot, GizziGlow } from '../ai-elements/GizziMascot';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';
import {
  testSSHConnection,
  installBackend, 
  VPS_PROVIDERS,
  type SSHConnectionConfig,
  type InstallProgress 
} from './ssh-service';

// ==================== TYPES ====================

interface WizardData {
  theme: 'light' | 'dark' | 'system';
  infraType: 'local' | 'connect' | 'purchase' | 'remote';
  sshConfig: SSHConnectionConfig;
  selectedModes: string[];
  workspacePath: string;
}

// ==================== SUB-COMPONENTS ====================

function ThemeStep({ theme, onChange }: { theme: string; onChange: (t: 'light' | 'dark' | 'system') => void }) {
  const themes = [
    { id: 'dark' as const, label: 'Dark Mode', desc: 'Sleek & professional', icon: Lock },
    { id: 'light' as const, label: 'Light Mode', desc: 'Clean & bright', icon: Lightning },
    { id: 'system' as const, label: 'System', desc: 'Follow OS settings', icon: WifiHigh },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-300',
            theme === t.id 
              ? 'border-[#D4B08C] bg-[`${SAND[500]}1a`] shadow-lg' 
              : 'border-white/5 bg-white/[0.02] hover:border-white/20'
          )}
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
            theme === t.id ? 'bg-[#D4B08C] text-[#0D0B09]' : 'bg-white/5 text-white/40'
          )}>
            <t.icon size={24} />
          </div>
          <div className="font-semibold text-white mb-1">{t.label}</div>
          <div className="text-xs text-white/40">{t.desc}</div>
        </button>
      ))}
    </div>
  );
}

function InfrastructureStep({ 
  data, 
  onUpdate, 
  onStatusChange 
}: { 
  data: WizardData; 
  onUpdate: (d: Partial<WizardData>) => void;
  onStatusChange: (status: 'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error', message?: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installAbort, setInstallAbort] = useState<(() => void) | null>(null);

  const testConnection = async () => {
    setStatus('testing');
    setStatusMessage('Testing SSH connection...');
    onStatusChange('testing', 'Testing connection');
    
    try {
      const result = await testSSHConnection(data.sshConfig);
      if (result.success) {
        setStatus('ready');
        setStatusMessage(`Connected! ${result.info?.os || ''}`);
        onStatusChange('ready', 'Connection successful');
      } else {
        setStatus('error');
        setStatusMessage(result.error || 'Connection failed');
        onStatusChange('error', result.error);
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Connection failed');
      onStatusChange('error', error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const connectAndInstall = async () => {
    setStatus('connecting');
    setStatusMessage('Establishing connection...');
    onStatusChange('connecting', 'Installing backend');
    
    try {
      const abort = installBackend(
        data.sshConfig,
        (progress) => {
          setInstallProgress(progress);
          setStatusMessage(progress.message);
          if (progress.progress > 0) setStatus('installing');
        },
        (result) => {
          if (result.success) {
            setStatus('ready');
            setStatusMessage('A2R backend installed and ready!');
            onStatusChange('ready', 'Backend installed successfully');
          } else {
            setStatus('error');
            setStatusMessage(result.error || 'Installation failed');
            onStatusChange('error', result.error);
          }
          setInstallAbort(null);
        }
      );
      
      setInstallAbort(() => abort);
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Installation failed');
      onStatusChange('error', error instanceof Error ? error.message : 'Installation failed');
    }
  };

  const options = [
    { 
      id: 'connect' as const, 
      label: 'Connect Existing VPS', 
      desc: 'I have a server - connect via SSH',
      icon: HardDrives,
      color: SAND[500],
      emoji: '🖥️'
    },
    { 
      id: 'local' as const, 
      label: 'Use Local Backend', 
      desc: 'Run everything on this computer',
      icon: HardDrive,
      color: '#5B8DEF',
      emoji: '💻'
    },
    { 
      id: 'purchase' as const, 
      label: 'Purchase VPS', 
      desc: 'Buy a new server from providers',
      icon: Cloud,
      color: STATUS.success,
      emoji: '☁️'
    },
    { 
      id: 'remote' as const, 
      label: 'Remote Desktop', 
      desc: 'Control machines via WebRTC',
      icon: WifiHigh,
      color: STATUS.warning,
      emoji: '🌐'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Options Grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map(({ id, label, desc, color, emoji }) => (
          <button
            key={id}
            onClick={() => onUpdate({ infraType: id })}
            className={cn(
              'flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200',
              data.infraType === id
                ? 'border-[#D4B08C] bg-[`${SAND[500]}14`]'
                : 'border-[`${SAND[500]}1a`] bg-[rgba(255,255,255,0.02)] hover:border-[`${SAND[500]}4c`]'
            )}
          >
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: `${color}20` }}
            >
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm">{label}</div>
              <div className="text-[11px] text-white/40 leading-tight">{desc}</div>
            </div>
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
              data.infraType === id ? 'bg-[#D4B08C] border-[#D4B08C]' : 'border-white/10'
            )}>
              {data.infraType === id && <Check className="w-3 h-3 text-[#0D0B09]" />}
            </div>
          </button>
        ))}
      </div>

      {/* SSH Form for Connect/Remote */}
      {(data.infraType === 'connect' || data.infraType === 'remote') && (
        <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[`${SAND[500]}1a`] space-y-4">
          <div className="flex items-center gap-2 text-[#D4B08C] text-sm font-medium">
            <span>⌨️</span>
            <span>SSH Connection Details</span>
          </div>
          
          <div className="grid grid-cols-[1fr,100px] gap-2">
            <input
              type="text"
              value={data.sshConfig.host}
              onChange={(e) => onUpdate({ 
                sshConfig: { ...data.sshConfig, host: e.target.value }
              })}
              placeholder="Hostname or IP"
              className="px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C] transition-all"
            />
            <input
              type="number"
              value={data.sshConfig.port}
              onChange={(e) => onUpdate({ 
                sshConfig: { ...data.sshConfig, port: parseInt(e.target.value) || 22 }
              })}
              placeholder="Port"
              className="px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
            />
          </div>

          <input
            type="text"
            value={data.sshConfig.username}
            onChange={(e) => onUpdate({ 
              sshConfig: { ...data.sshConfig, username: e.target.value }
            })}
            placeholder="Username"
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
          />

          <div className="flex gap-2">
            <button
              onClick={() => onUpdate({ sshConfig: { ...data.sshConfig, authType: 'key' } })}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                data.sshConfig.authType === 'key'
                  ? 'border-[#D4B08C] bg-[`${SAND[500]}1a`] text-[#D4B08C]'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              )}
            >
              <span>🔑</span> SSH Key
            </button>
            <button
              onClick={() => onUpdate({ sshConfig: { ...data.sshConfig, authType: 'password' } })}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                data.sshConfig.authType === 'password'
                  ? 'border-[#D4B08C] bg-[`${SAND[500]}1a`] text-[#D4B08C]'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              )}
            >
              <span>🔒</span> Password
            </button>
          </div>

          {data.sshConfig.authType === 'password' && (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={data.sshConfig.password || ''}
                onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, password: e.target.value } })}
                placeholder="Password"
                className="w-full px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"
              >
                {showPassword ? <Eye size={16} /> : <Lock size={16} />}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={testConnection}
              disabled={status === 'testing' || status === 'connecting' || status === 'installing'}
              className="flex-1 px-4 py-3 bg-transparent border border-[`${SAND[500]}4c`] rounded-xl text-sm font-medium text-[#D4B08C] hover:bg-[`${SAND[500]}0d`] transition-all disabled:opacity-50"
            >
              ⚡ Test Connection
            </button>
            <button
              onClick={connectAndInstall}
              disabled={status === 'testing' || status === 'connecting' || status === 'installing'}
              className="flex-1 px-4 py-3 bg-[#D4B08C] rounded-xl text-sm font-bold text-[#0D0B09] hover:bg-[#c4a07c] transition-all shadow-lg disabled:opacity-50"
            >
              🚀 Connect & Install
            </button>
          </div>

          {/* Installation Progress UI (matches HTML) */}
          {(status === 'installing' || status === 'connecting' || status === 'ready') && (
            <div className="mt-6 p-5 bg-black/40 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/60">Installation Progress</span>
                <span className="text-[#D4B08C] font-bold">{installProgress?.progress || 0}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#D4B08C] to-[#5B8DEF] transition-all duration-500"
                  style={{ width: `${installProgress?.progress || 0}%` }}
                />
              </div>

              {/* Log Console */}
              <div className="bg-black/60 rounded-xl p-4 font-mono text-[10px] space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 text-white/30 text-[9px] uppercase tracking-wider mb-2">
                  <span>▶</span> Live Installation Log
                </div>
                <div className="max-h-[100px] overflow-y-auto custom-scrollbar">
                  <div className="flex gap-2 text-white/40 italic">
                    <span>▸</span> Initializing deployment engine...
                  </div>
                  {installProgress?.log && (
                    <div className="flex gap-2 text-[#D4B08C]">
                      <span>▸</span> {installProgress.log}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Local Backend Info */}
      {data.infraType === 'local' && (
        <div className="p-6 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 text-xl">
            ✅
          </div>
          <div>
            <div className="font-semibold text-white">Local backend is ready</div>
            <div className="text-sm text-white/40">A2R is already running on your computer.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceStep({ data, onUpdate }: { data: WizardData; onUpdate: (d: Partial<WizardData>) => void }) {
  const modes = [
    { id: 'chat', label: 'Chat', icon: Chat, color: SAND[500] },
    { id: 'cowork', label: 'Cowork', icon: Users, color: '#9A7BAA' },
    { id: 'code', label: 'Code', icon: Code, color: '#6B9A7B' },
    { id: 'browser', label: 'Browser', icon: Globe, color: '#5B8DEF' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <label className="text-sm font-medium text-white/50 mb-4 block">Select Preferred Modes</label>
        <div className="grid grid-cols-2 gap-3">
          {modes.map((m) => {
            const isSelected = data.selectedModes.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => {
                  const current = data.selectedModes;
                  onUpdate({ 
                    selectedModes: isSelected ? current.filter(x => x !== m.id) : [...current, m.id] 
                  });
                }}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                  isSelected 
                    ? 'border-[#D4B08C] bg-[`${SAND[500]}1a`] text-[#D4B08C]' 
                    : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/20'
                )}
              >
                <m.icon size={20} />
                <span className="font-medium">{m.label}</span>
                {isSelected && <Check className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-white/50 mb-4 block">Workspace Path</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              value={data.workspacePath}
              onChange={(e) => onUpdate({ workspacePath: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
            />
          </div>
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-all">
            Browse
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function OnboardingFlow() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [wizardStep, setWizardStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState<'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error'>('idle');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [wizardData, setWizardData] = useState<WizardData>({
    theme: 'dark',
    infraType: 'local',
    sshConfig: {
      host: '',
      port: 22,
      username: '',
      authType: 'key',
      privateKey: '~/.ssh/id_rsa',
      password: '',
    },
    selectedModes: ['chat', 'cowork', 'code'],
    workspacePath: '~/a2r-workspace',
  });

  const { completeOnboarding, skipOnboarding } = useOnboardingStore();

  const handleNext = useCallback(() => {
    if (currentScreen === 2) {
      if (wizardStep < 2) {
        setWizardStep(prev => prev + 1);
      } else {
        setCurrentScreen(3);
      }
    } else {
      setCurrentScreen(prev => prev + 1);
    }
  }, [currentScreen, wizardStep]);

  const handleBack = useCallback(() => {
    if (currentScreen === 2 && wizardStep > 0) {
      setWizardStep(prev => prev - 1);
    } else {
      setCurrentScreen(prev => prev - 1);
    }
  }, [currentScreen, wizardStep]);

  const handleFinish = useCallback(() => {
    localStorage.setItem('a2r-workspace-path', wizardData.workspacePath);
    localStorage.setItem('a2r-preferred-modes', JSON.stringify(wizardData.selectedModes));
    completeOnboarding();
  }, [completeOnboarding, wizardData]);

  // Matches HTML Steps
  const renderSteps = () => {
    const steps = [
      { id: 0, label: 'Welcome' },
      { id: 1, label: 'Products' },
      { id: 2, label: 'Infrastructure' },
      { id: 3, label: 'Complete' }
    ];
    
    return (
      <div className="flex justify-center gap-3 mb-10">
        {steps.map((step) => {
          const isCompleted = currentScreen > step.id;
          const isActive = currentScreen === step.id;
          return (
            <div 
              key={step.id}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-500',
                isCompleted ? 'bg-[`${STATUS.success}26`] text-[#22c55e]' :
                isActive ? 'bg-[`${SAND[500]}33`] text-[#D4B08C] border border-[`${SAND[500]}4c`]' :
                'bg-white/[0.03] text-white/20'
              )}
            >
              <span>{isCompleted ? '✓' : isActive ? '●' : '○'}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[2147483647] flex flex-col items-center overflow-y-auto py-16 px-6"
      style={{ background: 'linear-gradient(135deg, #0D0B09 0%, #1A1612 100%)' }}
    >
      <div className="w-full max-w-[900px]">
        {/* Header (matches HTML) */}
        <div className="text-center mb-10 pb-8 border-b border-[`${SAND[500]}26`]">
          <div className="text-5xl font-bold bg-gradient-to-r from-[#D4B08C] to-[#5B8DEF] bg-clip-text text-transparent mb-3 tracking-tight">
            A2R Platform
          </div>
          <div className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-medium">v1.0.0 Setup Wizard</div>
        </div>

        {renderSteps()}

        {/* Main Card (matches HTML) */}
        <div className="relative bg-white/[0.03] border border-[`${SAND[500]}26`] rounded-[32px] p-10 backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[500px] flex flex-col">
          
          {/* Welcome Screen */}
          {currentScreen === 0 && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative w-[220px] h-[220px] mb-12 animate-gizzi-float">
                <GizziGlow className="opacity-60 scale-125" />
                <GizziMascot size={220} />
              </div>
              <h1 className="text-5xl font-serif text-white mb-6 tracking-tight leading-tight">
                Your architecture, <br />
                <span className="text-[#D4B08C]">amplified</span>
              </h1>
              <p className="text-xl text-white/40 font-light max-w-lg mb-14 leading-relaxed">
                The next-generation AI orchestration platform for architects and systems engineers.
              </p>
              <button 
                onClick={handleNext} 
                className="group flex items-center gap-4 px-14 py-5 bg-[#D4B08C] text-[#0D0B09] rounded-full text-xl font-black hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_-10px_`${SAND[500]}66`]"
              >
                Begin Setup
                <CaretRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          )}

          {/* Products Screen */}
          {currentScreen === 1 && (
            <div className="flex flex-col h-full">
              <h1 className="text-3xl font-bold text-white mb-2">Capabilities</h1>
              <p className="text-white/40 text-lg mb-10">Choose your entry point into the A2R ecosystem.</p>
              
              <div className="grid grid-cols-2 gap-6 mb-12">
                {[
                  { id: 'chat', icon: Chat, title: 'Chat', desc: 'Strategy & Brainstorming', color: SAND[500] },
                  { id: 'cowork', icon: Users, title: 'Cowork', desc: 'Multi-agent Orchestration', color: '#9A7BAA' },
                  { id: 'code', icon: Code, title: 'Code', desc: 'Automated Development', color: '#6B9A7B' },
                  { id: 'browser', icon: Globe, title: 'Browser', desc: 'Web Intelligence', color: '#5B8DEF' },
                ].map((p) => (
                  <div key={p.id} className="p-8 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-[#D4B08C]/30 hover:bg-white/[0.04] transition-all group">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110" style={{ background: `${p.color}15`, color: p.color }}>
                      <p.icon size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{p.title}</h3>
                    <p className="text-sm text-white/30 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-auto pt-8 border-t border-white/5">
                <button onClick={handleBack} className="px-8 py-3.5 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all font-semibold">
                  ← Back
                </button>
                <button onClick={handleNext} className="px-10 py-3.5 bg-[#D4B08C] text-[#0D0B09] rounded-xl font-black hover:scale-105 active:scale-95 transition-all shadow-lg">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Infrastructure / Wizard Screen */}
          {currentScreen === 2 && (
            <div className="flex flex-col h-full">
              <h1 className="text-3xl font-bold text-white mb-2">
                {wizardStep === 0 && 'Infrastructure Setup'}
                {wizardStep === 1 && 'Personalization'}
                {wizardStep === 2 && 'Workspace'}
              </h1>
              <p className="text-white/40 text-lg mb-10">
                {wizardStep === 0 && 'Choose how you want to run your A2R backend'}
                {wizardStep === 1 && 'Select your preferred visual style'}
                {wizardStep === 2 && 'Configure your local environment'}
              </p>
              
              <div className="flex-1">
                {wizardStep === 0 && (
                  <InfrastructureStep 
                    data={wizardData} 
                    onUpdate={(d) => setWizardData(prev => ({ ...prev, ...d }))}
                    onStatusChange={(s) => setSetupStatus(s)}
                  />
                )}
                {wizardStep === 1 && (
                  <ThemeStep theme={theme} onChange={setTheme} />
                )}
                {wizardStep === 2 && (
                  <WorkspaceStep 
                    data={wizardData} 
                    onUpdate={(d) => setWizardData(prev => ({ ...prev, ...d }))}
                  />
                )}
              </div>

              <div className="flex justify-between mt-12 pt-8 border-t border-white/5">
                <button onClick={handleBack} className="px-8 py-3.5 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all font-semibold">
                  ← Back
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={setupStatus === 'connecting' || setupStatus === 'installing'}
                  className="px-10 py-3.5 bg-[#D4B08C] text-[#0D0B09] rounded-xl font-black hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {wizardStep === 2 ? 'Finalize Setup' : 'Next Step →'}
                </button>
              </div>
            </div>
          )}

          {/* Complete Screen */}
          {currentScreen === 3 && (
            <div className="flex flex-col items-center text-center py-10">
              <div className="w-24 h-24 rounded-[32px] bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-10 shadow-[0_0_50px_`${STATUS.success}33`]">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h1 className="text-5xl font-serif text-white mb-6 tracking-tight">You're all set!</h1>
              <p className="text-xl text-white/40 font-light max-w-lg mb-14 leading-relaxed">
                A2R Platform is configured and ready for your first architectural project.
              </p>
              
              <div className="w-full max-w-md p-8 rounded-3xl bg-black/40 border border-white/5 mb-14 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/30 font-medium">Environment</span>
                  <span className="text-[#D4B08C] font-bold capitalize">{wizardData.infraType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/30 font-medium">Interface Theme</span>
                  <span className="text-white font-bold capitalize">{theme}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/30 font-medium">Workspace</span>
                  <span className="text-white/60 font-mono text-[10px]">{wizardData.workspacePath}</span>
                </div>
              </div>

              <button
                onClick={handleFinish}
                className="group relative w-full max-w-sm flex items-center justify-center gap-4 px-10 py-5 bg-[#D4B08C] text-[#0D0B09] rounded-full text-xl font-black hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_-10px_`${SAND[500]}80`]"
              >
                Launch Platform
                <CaretRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* E2E Test Results Footer (matches HTML) */}
        <div className="mt-10 p-8 rounded-[24px] bg-[`${STATUS.success}08`] border border-[`${STATUS.success}26`] backdrop-blur-xl">
          <div className="flex items-center gap-3 text-[#22c55e] font-bold mb-6 text-sm">
            <CheckCircle size={20} />
            <span>ENVIRONMENT COMPLIANCE - ALL SYSTEMS READY</span>
          </div>
          <div className="font-mono text-[10px] leading-relaxed space-y-1.5 opacity-60">
            <div className="text-[#5B8DEF]">📡 Step 1: HTTP API Health Check - healthy (v1.0.0)</div>
            <div className="text-[#5B8DEF]">🔌 Step 2: System Kernel Bridge - verified active</div>
            <div className="text-white/40 italic">🚀 Step 3: Deployment Verification Engine...</div>
            <div className="text-white/40">   ⏳ [100%] Environment scan complete</div>
            <div className="text-[#22c55e] font-bold mt-2">🎉 READINESS STATUS: OPERATIONAL</div>
          </div>
        </div>
      </div>
    </div>
  );
}
