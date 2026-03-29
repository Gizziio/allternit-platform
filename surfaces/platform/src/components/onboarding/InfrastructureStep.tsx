/**
 * Infrastructure Setup Step
 * 
 * Handles VPS connection and backend installation.
 */

import { useState, useEffect } from 'react';
import {
  HardDrives,
  Cloud,
  WifiHigh,
  HardDrive,
  Terminal,
  Key,
  Lock,
  Eye,
  Lightning,
  Check,
  Warning,
  CircleNotch,
  CheckCircle,
  ArrowSquareOut,
  CaretRight,
  Circle,
  Play,
  DownloadSimple,
  GearSix,
  RocketLaunch,
  Shield,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';
import {
  testSSHConnection,
  installBackend,
  VPS_PROVIDERS,
  STEP_DESCRIPTIONS,
  STEP_DETAILS,
  type SSHConnectionConfig,
  type InstallProgress,
  type InstallStep,
  type SystemInfo,
  savePurchaseIntent
} from './ssh-service';

interface Props {
  data: {
    infraType: string;
    sshConfig: SSHConnectionConfig;
  };
  onUpdate: (data: { infraType?: string; sshConfig?: SSHConnectionConfig }) => void;
  onStatusChange: (status: 'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error', message?: string) => void;
}

const options = [
  { id: 'local', label: 'Use Local Backend', desc: 'Run everything on this computer (already set up)', icon: HardDrive, color: '#5B8DEF' },
  { id: 'connect', label: 'Connect Existing VPS', desc: 'I have a server - connect via SSH', icon: HardDrives, color: SAND[500] },
  { id: 'purchase', label: 'Purchase VPS', desc: 'Buy a new server from recommended providers', icon: Cloud, color: STATUS.success },
  { id: 'remote', label: 'Remote Desktop Control', desc: 'Control machines via WebRTC', icon: WifiHigh, color: STATUS.warning },
];

export function InfrastructureStep({ data, onUpdate, onStatusChange }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'connecting' | 'installing' | 'ready' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<InstallStep>('connecting');

  // Check for completed VPS purchases
  useEffect(() => {
    // In production, this would poll for completed purchases
    const checkPurchases = () => {
      // checkCompletedPurchases() would be called here
    };
    
    const interval = setInterval(checkPurchases, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    setStatus('testing');
    setStatusMessage('Testing SSH connection...');
    onStatusChange('testing');

    try {
      const result = await testSSHConnection(data.sshConfig);
      
      if (result.success && result.systemInfo) {
        setSystemInfo(result.systemInfo);
        setStatus('ready');
        setStatusMessage(`Connected! ${result.systemInfo.os} (${result.systemInfo.architecture})`);
        onStatusChange('ready', `Connected to ${result.systemInfo.os}`);
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

  const handleConnectAndInstall = () => {
    setStatus('connecting');
    setStatusMessage('Starting installation...');
    onStatusChange('connecting');

    setInstallLog([]);
    setCurrentStep('connecting');
    
    const abort = installBackend(
      data.sshConfig,
      (progress) => {
        setInstallProgress(progress);
        setCurrentStep(progress.step);
        setStatus('installing');
        setStatusMessage(progress.message);
        onStatusChange('installing', progress.message);
        
        // Add to log if new message
        setInstallLog(prev => {
          if (progress.message && !prev.includes(progress.message)) {
            return [...prev.slice(-9), progress.message]; // Keep last 10 messages
          }
          return prev;
        });
      },
      (result) => {
        if (result.success) {
          if (result.systemInfo) {
            setSystemInfo(result.systemInfo);
          }
          setStatus('ready');
          setStatusMessage('A2R backend installed and ready!');
          onStatusChange('ready', 'Backend installed successfully');
          setCurrentStep('complete');
        } else {
          setStatus('error');
          setStatusMessage(result.error || 'Installation failed');
          onStatusChange('error', result.error);
          setCurrentStep('error');
        }
        setAbortFn(null);
      }
    );

    setAbortFn(() => abort);
  };

  const handleProviderClick = (provider: typeof VPS_PROVIDERS[0]) => {
    // Save purchase intent so we can help connect after they buy
    savePurchaseIntent(provider.id, {});
    window.open(provider.url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Options */}
      <div className="space-y-2">
        {options.map(({ id, label, desc, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => onUpdate({ infraType: id })}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200',
              data.infraType === id
                ? 'border-[#D4B08C] bg-[`${SAND[500]}14`]'
                : 'border-[`${SAND[500]}1a`] bg-[rgba(255,255,255,0.02)] hover:border-[`${SAND[500]}40`]'
            )}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}20`, color }}>
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">{label}</div>
              <div className="text-sm text-white/50">{desc}</div>
            </div>
            <div className={cn('w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              data.infraType === id ? 'bg-[#D4B08C] border-[#D4B08C]' : 'border-white/20')}>
              {data.infraType === id && <Check className="w-3.5 h-3.5 text-[#0D0B09]" />}
            </div>
          </button>
        ))}
      </div>

      {/* SSH Form */}
      {(data.infraType === 'connect' || data.infraType === 'remote') && (
        <div className="mt-4 p-4 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[`${SAND[500]}1a`] space-y-3">
          <div className="flex items-center gap-2 mb-3 text-[#D4B08C] text-sm font-medium">
            <Terminal size={16} />
            SSH Connection Details
          </div>
          
          <div className="grid grid-cols-[1fr,80px] gap-2">
            <input
              type="text"
              value={data.sshConfig.host}
              onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, host: e.target.value } })}
              placeholder="Hostname or IP"
              className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]"
            />
            <input
              type="number"
              value={data.sshConfig.port}
              onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, port: parseInt(e.target.value) || 22 } })}
              className="px-3 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
            />
          </div>

          <input
            type="text"
            value={data.sshConfig.username}
            onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, username: e.target.value } })}
            placeholder="Username"
            className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]"
          />

          {/* Auth Toggle */}
          <div className="flex gap-2">
            {[
              { id: 'key' as const, label: 'SSH Key', icon: Key },
              { id: 'password' as const, label: 'Password', icon: Lock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onUpdate({ sshConfig: { ...data.sshConfig, authType: id } })}
                className={cn('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
                  data.sshConfig.authType === id
                    ? 'border-[#D4B08C] bg-[`${SAND[500]}1a`] text-[#D4B08C]'
                    : 'border-[`${SAND[500]}26`] text-white/50')}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Auth Input */}
          {data.sshConfig.authType === 'key' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={data.sshConfig.privateKey}
                onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, privateKey: e.target.value } })}
                className="flex-1 px-3 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm focus:outline-none focus:border-[#D4B08C]"
              />
              <button className="px-4 py-2.5 bg-[rgba(255,255,255,0.05)] border border-[`${SAND[500]}26`] rounded-xl text-sm text-white/60 hover:text-white hover:border-[#D4B08C]">
                Browse
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={data.sshConfig.password}
                onChange={(e) => onUpdate({ sshConfig: { ...data.sshConfig, password: e.target.value } })}
                placeholder="Password"
                className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.03)] border border-[`${SAND[500]}26`] rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D4B08C]"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                <Eye size={16} />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={status === 'testing' || status === 'connecting' || status === 'installing'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[`${SAND[500]}4c`] rounded-xl text-sm text-[#D4B08C] hover:bg-[`${SAND[500]}1a`] disabled:opacity-50"
            >
              {status === 'testing' ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Lightning size={16} />}
              Test Connection
            </button>
            <button
              onClick={handleConnectAndInstall}
              disabled={status === 'testing' || status === 'connecting' || status === 'installing'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D4B08C] rounded-xl text-sm text-[#0D0B09] font-medium hover:bg-[#c4a07c] disabled:opacity-50"
            >
              {status === 'connecting' || status === 'installing' ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <HardDrives size={16} />
              )}
              {status === 'installing' ? 'Installing...' : 'Connect & Install'}
            </button>
          </div>

          {/* Status */}
          {status !== 'idle' && statusMessage && (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
              status === 'error' ? 'bg-red-500/10 text-red-400' : 
              status === 'ready' ? 'bg-green-500/10 text-green-400' :
              'bg-[`${SAND[500]}1a`] text-[#D4B08C]')}>
              {status === 'error' ? <Warning size={16} /> :
               status === 'ready' ? <CheckCircle size={16} /> :
               <CircleNotch className="w-4 h-4 animate-spin" />}
              {statusMessage}
            </div>
          )}

          {/* Installation Progress - Play by Play */}
          {installProgress && status === 'installing' && (
            <div className="space-y-3">
              {/* Overall Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white/60">
                  <span>Installation Progress</span>
                  <span>{installProgress.progress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#D4B08C] to-[#5B8DEF] transition-all duration-500" 
                    style={{ width: `${installProgress.progress}%` }} />
                </div>
              </div>
              
              {/* Step-by-Step Checklist */}
              <div className="bg-black/20 rounded-xl p-3 space-y-2">
                {[
                  { id: 'connecting', label: 'Connect via SSH', icon: Terminal },
                  { id: 'detecting_os', label: 'Probe Server', icon: HardDrives },
                  { id: 'preparing', label: 'Save Connection', icon: HardDrive },
                  { id: 'downloading', label: 'Install Backend', icon: DownloadSimple },
                  { id: 'configuring', label: 'Sync Config', icon: GearSix },
                  { id: 'starting', label: 'Start Runtime', icon: RocketLaunch },
                  { id: 'verifying', label: 'Activate Backend', icon: Shield },
                ].map((step, index) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = ['complete', 'verifying', 'starting', 'configuring', 'downloading', 'preparing', 'detecting_os'].indexOf(currentStep) <= 
                    ['complete', 'verifying', 'starting', 'configuring', 'downloading', 'preparing', 'detecting_os'].indexOf(step.id) && 
                    currentStep !== 'error';
                  const isDone = !isActive && !isCompleted;
                  
                  return (
                    <div 
                      key={step.id}
                      className={cn(
                        'flex items-center gap-2 text-sm transition-all duration-300',
                        isActive ? 'text-[#D4B08C]' : isDone ? 'text-white/30' : 'text-white/60'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center transition-all',
                        isActive ? 'bg-[#D4B08C]/20 animate-pulse' : isDone ? 'bg-green-500/20' : 'bg-white/5'
                      )}>
                        {isDone ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : isActive ? (
                          <step.icon size={12} />
                        ) : (
                          <Circle size={12} />
                        )}
                      </div>
                      <span className={cn(isActive && 'font-medium')}>
                        {index + 1}. {step.label}
                      </span>
                      {isActive && <CircleNotch className="w-3 h-3 animate-spin ml-auto" />}
                    </div>
                  );
                })}
              </div>
              
              {/* Live Log Console */}
              {installLog.length > 0 && (
                <div className="bg-black/30 rounded-xl p-3 font-mono text-xs">
                  <div className="text-white/40 mb-2 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Play size={12} />
                    Live Installation Log
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {installLog.map((log, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          'flex items-start gap-2 transition-all',
                          i === installLog.length - 1 ? 'text-[#D4B08C]' : 'text-white/50'
                        )}
                      >
                        <CaretRight className={cn(
                          'w-3 h-3 mt-0.5 flex-shrink-0',
                          i === installLog.length - 1 && 'animate-pulse'
                        )} />
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Current Step Description */}
              <div className="text-xs text-white/50 bg-[`${SAND[500]}0d`] p-2 rounded-lg">
                {STEP_DESCRIPTIONS[currentStep]}
              </div>
            </div>
          )}

          {/* System Info */}
          {systemInfo && status === 'ready' && (
            <div className="p-3 rounded-lg bg-white/5 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-white/50">OS:</span> <span className="text-white">{systemInfo.os}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Architecture:</span> <span className="text-white">{systemInfo.architecture}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Service Manager:</span> <span className="text-white">{systemInfo.hasSystemd ? 'systemd' : 'Direct Process'}</span></div>
              <div className="flex justify-between"><span className="text-white/50">A2R:</span> <span className="text-white">{systemInfo.isA2RInstalled ? `v${systemInfo.a2rVersion}` : 'Will install natively'}</span></div>
            </div>
          )}
        </div>
      )}

      {/* Provider Cards */}
      {data.infraType === 'purchase' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-white/50">
            Choose a provider. After purchase, return here and select "Connect Existing VPS" with the credentials they email you.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {VPS_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderClick(provider)}
                className="group p-4 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[`${SAND[500]}1a`] hover:border-[#D4B08C] transition-all text-center"
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                  <img src={provider.logo} alt={provider.name} className="w-10 h-10 object-contain" 
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-xl font-bold text-[#D4B08C] hidden">{provider.name[0]}</span>
                </div>
                <h4 className="font-semibold text-white text-sm">{provider.name}</h4>
                <p className="text-xs text-white/40 mb-2">{provider.description}</p>
                <div className="text-sm font-medium text-[#D4B08C]">{provider.startingPrice}</div>
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-white/30 group-hover:text-[#D4B08C]">
                  Open <ArrowSquareOut size={12} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Local Ready */}
      {data.infraType === 'local' && (
        <div className="mt-4 p-4 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="font-medium text-white">Local backend is ready</div>
            <div className="text-sm text-white/50">A2R is already running on your computer</div>
          </div>
        </div>
      )}
    </div>
  );
}
