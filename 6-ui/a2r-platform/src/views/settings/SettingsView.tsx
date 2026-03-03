import React, { useState } from 'react';
import GlassSurface from '@/design/GlassSurface';
import {
  Settings,
  Palette,
  Cpu,
  Key,
  Keyboard,
  Info,
  Check,
  Trash2,
  Plus,
  Sun,
  Moon,
  Smartphone,
  User,
  Server,
  Shield,
  Bot,
  Cloud,
  Network,
  Lock,
  Target,
  Recycle,
  FileCode,
  Gauge,
  Code2,
  Briefcase,
  Puzzle,
  CreditCard,
  BookOpen,
  GraduationCap,
  FileText,
  ArrowUpRight,
  Terminal,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { ClerkAuthPanel } from '../../../../../7-apps/shell/web/src/components/ClerkAuthPanel';
import { VPSConnectionsPanel } from '../../../../../7-apps/shell/web/src/components/VPSConnectionsPanel';

type SettingsSection = 'general' | 'appearance' | 'models' | 'api-keys' | 'shortcuts' | 'about' | 'signin' | 'vps' | 'infrastructure' | 'security' | 'agents' | 'gizziio-code' | 'cowork' | 'extensions' | 'billing';
type Theme = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large';
type DefaultMode = 'chat' | 'cowork' | 'code';

const SHORTCUTS = [
  { action: 'New Chat', shortcut: '⌘N' },
  { action: 'Toggle Sidebar', shortcut: '⌘\\' },
  { action: 'Search', shortcut: '⌘K' },
  { action: 'Close View', shortcut: '⌘W' },
  { action: 'Switch Mode (Chat)', shortcut: '⌘1' },
  { action: 'Switch Mode (Cowork)', shortcut: '⌘2' },
  { action: 'Switch Mode (Code)', shortcut: '⌘3' },
  { action: 'Run Agent', shortcut: '⌘R' },
  { action: 'Toggle Theme', shortcut: '⌘Shift+T' },
  { action: 'Open Settings', shortcut: '⌘,' },
];

const ACCENT_COLORS = [
  { name: 'Sand', value: '#d4b08c' },
  { name: 'Blue', value: '#007aff' },
  { name: 'Purple', value: '#af52de' },
  { name: 'Green', value: '#34c759' },
  { name: 'Red', value: '#ef4444' },
];

const MODEL_OPTIONS = ['GPT-4o', 'Claude 3.5', 'Mistral 7B', 'Gemini Flash'];

const API_PROVIDERS = [
  { name: 'OpenAI', letter: 'O' },
  { name: 'Anthropic', letter: 'A' },
  { name: 'Mistral', letter: 'M' },
  { name: 'Google', letter: 'G' },
];

export const SettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('signin');

  // Listen for navigation events from SettingsOverlay
  React.useEffect(() => {
    const handleNavigateSettings = (event: CustomEvent<{ section: string }>) => {
      const sectionMap: Record<string, SettingsSection> = {
        signin: 'signin',
        vps: 'vps',
        general: 'general'
      };
      if (event.detail?.section && sectionMap[event.detail.section]) {
        setActiveSection(sectionMap[event.detail.section]);
      }
    };

    window.addEventListener('a2r:navigate-settings' as any, handleNavigateSettings as any);
    return () => window.removeEventListener('a2r:navigate-settings' as any, handleNavigateSettings as any);
  }, []);

  // General Settings
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('UTC');
  const [showSystemMessages, setShowSystemMessages] = useState(true);
  const [enableTelemetry, setEnableTelemetry] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [defaultMode, setDefaultMode] = useState<DefaultMode>('chat');

  // Appearance Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [compactDensity, setCompactDensity] = useState(false);
  const [showSidebarLabels, setShowSidebarLabels] = useState(true);
  const [animateTransitions, setAnimateTransitions] = useState(true);
  const [accentColor, setAccentColor] = useState('#d4b08c');

  // Models Settings
  const [chatModel, setChatModel] = useState('GPT-4o');
  const [codeModel, setCodeModel] = useState('Claude 3.5');
  const [analysisModel, setAnalysisModel] = useState('Mistral 7B');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState('2000');
  const [streaming, setStreaming] = useState(true);

  // API Keys Settings
  const [apiKeys, setApiKeys] = useState<Record<string, { masked: string; isSet: boolean }>>({
    OpenAI: { masked: 'sk-••••••••••••••••', isSet: true },
    Anthropic: { masked: '', isSet: false },
    Mistral: { masked: '', isSet: false },
    Google: { masked: '', isSet: false },
  });

  // Gizziio Code Settings
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [drawAttentionNotifications, setDrawAttentionNotifications] = useState(true);
  const [worktreeLocation, setWorktreeLocation] = useState('Inside project (.claude/)');
  const [branchPrefix, setBranchPrefix] = useState('gizziio');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [persistPreviewSessions, setPersistPreviewSessions] = useState(false);

  // Extensions Settings
  const [autoUpdateExtensions, setAutoUpdateExtensions] = useState(true);
  const [useBuiltinNode, setUseBuiltinNode] = useState(true);

  const toggleSwitch = (
    value: boolean,
    setter: (value: boolean) => void,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setter(!value);
  };

  const renderGeneralPanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
          Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <option>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
          <option>Japanese</option>
        </select>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#ffffff' }}>
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            color: '#ffffff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          <option>UTC</option>
          <option>EST</option>
          <option>CST</option>
          <option>PST</option>
          <option>GMT</option>
        </select>
      </div>

      <ToggleItem
        label="Show system messages"
        value={showSystemMessages}
        onChange={setShowSystemMessages}
        description="Display internal system operations"
      />

      <ToggleItem
        label="Enable telemetry"
        value={enableTelemetry}
        onChange={setEnableTelemetry}
        description="Help improve A2R by sharing usage data"
      />

      <ToggleItem
        label="Auto-save"
        value={autoSave}
        onChange={setAutoSave}
        description="Automatically save your work"
      />

      <div style={{ marginTop: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#ffffff' }}>
          Default Mode
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(['chat', 'cowork', 'code'] as const).map((mode) => (
            <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="defaultMode"
                value={mode}
                checked={defaultMode === mode}
                onChange={(e) => setDefaultMode(e.target.value as DefaultMode)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: '#d0d0d0' }}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAppearancePanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#ffffff' }}>
          Theme
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: theme === t ? '2px solid #d4b08c' : '1px solid var(--border-subtle)',
                backgroundColor: theme === t ? 'rgba(212, 176, 140, 0.1)' : 'var(--bg-secondary)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              {t === 'light' && <Sun size={16} />}
              {t === 'dark' && <Moon size={16} />}
              {t === 'system' && <Smartphone size={16} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#ffffff' }}>
          Font Size
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: fontSize === size ? '2px solid #d4b08c' : '1px solid var(--border-subtle)',
                backgroundColor: fontSize === size ? 'rgba(212, 176, 140, 0.1)' : 'var(--bg-secondary)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <ToggleItem
        label="Compact density"
        value={compactDensity}
        onChange={setCompactDensity}
        description="Use less vertical spacing"
      />

      <ToggleItem
        label="Show sidebar labels"
        value={showSidebarLabels}
        onChange={setShowSidebarLabels}
        description="Display text labels in sidebar"
      />

      <ToggleItem
        label="Animate transitions"
        value={animateTransitions}
        onChange={setAnimateTransitions}
        description="Use smooth animations"
      />

      <div style={{ marginTop: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#ffffff' }}>
          Accent Color
        </label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: color.value,
                border: accentColor === color.value ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: accentColor === color.value ? '0 0 0 2px var(--bg-primary)' : 'none',
              }}
            >
              {accentColor === color.value && <Check size={20} style={{ color: '#ffffff' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderModelsPanel = () => (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
          Default Models
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '6px' }}>
              Chat
            </label>
            <select
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: '#ffffff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '6px' }}>
              Code
            </label>
            <select
              value={codeModel}
              onChange={(e) => setCodeModel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: '#ffffff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '6px' }}>
              Analysis
            </label>
            <select
              value={analysisModel}
              onChange={(e) => setAnalysisModel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: '#ffffff',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '0' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
          Model Settings
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '8px' }}>
            Temperature: {temperature.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              backgroundColor: 'var(--bg-secondary)',
              outline: 'none',
              accentColor: '#d4b08c',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#d0d0d0', marginBottom: '6px' }}>
            Max Tokens
          </label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: '#ffffff',
              fontSize: '13px',
            }}
          />
        </div>

        <ToggleItem
          label="Streaming"
          value={streaming}
          onChange={setStreaming}
          description="Stream responses in real-time"
        />
      </div>
    </div>
  );

  const renderApiKeysPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        {API_PROVIDERS.map((provider) => (
          <div
            key={provider.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              marginBottom: '12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#d4b08c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1a1612',
                fontWeight: '600',
                fontSize: '16px',
              }}
            >
              {provider.letter}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff', marginBottom: '4px' }}>
                {provider.name}
              </div>
              <input
                type="password"
                placeholder="sk-••••••••••••••••"
                value={apiKeys[provider.name]?.masked || ''}
                readOnly
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-primary)',
                  color: '#d0d0d0',
                  fontSize: '12px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-primary)',
                  color: '#d0d0d0',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                  e.currentTarget.style.color = '#d0d0d0';
                }}
              >
                Edit
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-primary)',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                }}
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'transparent',
          color: '#d4b08c',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s ease',
          marginBottom: '20px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(212, 176, 140, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Plus size={16} />
        Add New Key
      </button>

      <div
        style={{
          padding: '12px',
          borderRadius: '6px',
          backgroundColor: 'rgba(212, 176, 140, 0.08)',
          borderLeft: '3px solid #d4b08c',
          fontSize: '12px',
          color: '#d0d0d0',
          lineHeight: '1.5',
        }}
      >
        Keys are stored locally and never sent to external servers
      </div>
    </div>
  );

  const renderShortcutsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <div
        style={{
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#ffffff',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            Action
          </div>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#ffffff' }}>
            Shortcut
          </div>
        </div>

        {SHORTCUTS.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderBottom: index !== SHORTCUTS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                color: '#ffffff',
                borderRight: '1px solid var(--border-subtle)',
              }}
            >
              {item.action}
            </div>
            <div
              style={{
                padding: '12px 16px',
                fontSize: '12px',
                color: '#d0d0d0',
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {item.shortcut}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAboutPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      {/* A2R Logo Grid */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            width: '160px',
            height: '160px',
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#d4b08c',
                borderRadius: '4px',
                opacity: i % 3 === 0 ? 0.3 : i % 2 === 0 ? 0.6 : 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '32px',
            margin: '0 0 8px 0',
            color: '#ffffff',
            fontWeight: '600',
          }}
        >
          A2R &amp;
          <span style={{ fontFamily: 'serif', fontSize: '32px', color: '#d4b08c' }}>
            {' '}Coffee
          </span>
        </h1>
      </div>

      {/* Version Info */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '8px' }}>
          v0.9.1-beta
        </div>
        <div style={{ fontSize: '12px', color: '#b0b0b0' }}>
          Build: 2026-02-26 • Production
        </div>
      </div>

      {/* Links */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
          fontSize: '13px',
        }}
      >
        <a href="#" style={{ color: '#d4b08c', textDecoration: 'none', cursor: 'pointer' }}>
          Documentation
        </a>
        <a href="#" style={{ color: '#d4b08c', textDecoration: 'none', cursor: 'pointer' }}>
          Changelog
        </a>
        <a href="#" style={{ color: '#d4b08c', textDecoration: 'none', cursor: 'pointer' }}>
          GitHub
        </a>
        <a href="#" style={{ color: '#d4b08c', textDecoration: 'none', cursor: 'pointer' }}>
          Support
        </a>
      </div>
    </div>
  );

  // Infrastructure Panel - Cloud Deploy, Node Management
  const renderInfrastructurePanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Cloud Deployment
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Cloud size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Cloud Deploy</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Manage cloud deployments</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Compute Nodes
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Network size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Node Management</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Manage compute nodes</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          BYOC VPS
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Server size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>VPS Connections</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Manage your own compute</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // Security Panel - Policy, Governance
  const renderSecurityPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Policy & Governance
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Shield size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Policy Manager</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Manage governance policies</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Lock size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Policy Gating</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Rule enforcement engine</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Target size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Purpose Binding</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Purpose alignment controls</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Security Dashboard
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Gauge size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Security Overview</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Security monitoring dashboard</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
      </section>
    </div>
  );

  // Agents Panel - Advanced Agent Settings
  const renderAgentsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Agent Operations
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Bot size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Evaluation Harness</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Test and evaluate agents</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <FileCode size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Autonomous Code Factory</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Self-modifying code generation</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Recycle size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>GC Agents</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Garbage collection status</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#666', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
            Status: Backend implemented, UI placeholder
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Advanced Memory
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cpu size={20} color="#d4b08c" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Memory Kernel</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Advanced memory system</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // Gizziio Code Panel - Code Mode Settings
  const renderGizziioCodePanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, #D97757 0%, #B08D6E 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Code2 size={24} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
              Gizziio Code
            </h3>
            <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0 0' }}>
              Agentic coding tool that lives in your terminal
            </p>
          </div>
        </div>
        
        <div style={{ 
          padding: '12px 16px', 
          background: '#252525', 
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '13px', color: '#d4b08c' }}>Install instructions</span>
          <ArrowUpRight size={16} color="#d4b08c" />
        </div>

        <div style={{ 
          padding: '12px 16px', 
          background: '#1f1f1f', 
          borderRadius: '8px',
          border: '1px solid #333',
          marginBottom: '24px'
        }}>
          <p style={{ fontSize: '13px', color: '#a0a0a0', margin: 0 }}>
            <Info size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            When you sign in to Gizziio Code using your subscription, your subscription usage limits are shared with Gizziio Code.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Gizziio Code Desktop Settings
        </h3>
        
        <ToggleItem
          label="Allow bypass permissions mode"
          value={bypassPermissions}
          onChange={setBypassPermissions}
          description="Bypass all permission checks and let agents work uninterrupted. This works well for workflows like fixing lint errors or generating boilerplate code."
        />
        
        <ToggleItem
          label="Draw attention on notifications"
          value={drawAttentionNotifications}
          onChange={setDrawAttentionNotifications}
          description="Bounce the dock icon or flash the taskbar when agents need your attention and the app is not focused."
        />

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#ffffff' }}>
            Worktree location
          </label>
          <select
            value={worktreeLocation}
            onChange={(e) => setWorktreeLocation(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            <option>Inside project (.claude/)</option>
            <option>Outside project</option>
            <option>Custom path</option>
          </select>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
            Where to store git worktrees for isolated coding sessions
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#ffffff' }}>
            Branch prefix
          </label>
          <input
            type="text"
            value={branchPrefix}
            onChange={(e) => setBranchPrefix(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: '#ffffff',
              fontSize: '14px',
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
            Prefix added to the beginning of every worktree branch name
          </p>
        </div>

        <ToggleItem
          label="Preview"
          value={previewEnabled}
          onChange={setPreviewEnabled}
          description="Agents can start dev servers, open a live preview, and verify code changes with screenshots, snapshots, and DOM inspection."
        />
        
        <ToggleItem
          label="Persist Preview sessions"
          value={persistPreviewSessions}
          onChange={setPersistPreviewSessions}
          description="Save cookies, local storage, and login sessions for dev server previews. Data is stored per workspace and persists across app restarts."
        />
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Manage your authorization tokens
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Terminal size={20} color="#d4b08c" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Gizziio Code</div>
              <div style={{ fontSize: '12px', color: '#888' }}>user:inference</div>
            </div>
            <button style={{ 
              padding: '6px 12px', 
              borderRadius: '4px', 
              border: '1px solid #444',
              background: 'transparent',
              color: '#888',
              fontSize: '12px',
              cursor: 'pointer'
            }}>
              Revoke
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  // Cowork Panel - Cowork Mode Settings
  const renderCoworkPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
            Cowork
          </h3>
          <span style={{ 
            padding: '2px 8px', 
            background: '#d4b08c20', 
            borderRadius: '4px', 
            fontSize: '11px', 
            color: '#d4b08c',
            fontWeight: '500'
          }}>
            Preview
          </span>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
            Global instructions
          </h3>
          <button style={{ 
            padding: '6px 16px', 
            borderRadius: '6px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#e5e5e5',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Edit
          </button>
        </div>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 16px 0', lineHeight: '1.5' }}>
          Instructions here apply to all Cowork sessions. Use this for preferences, conventions, or context that agents should always know.
        </p>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
          Delete Cowork sessions
        </h3>
        <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
          To delete your Cowork sessions, email A2R support at{' '}
          <a href="mailto:support@a2r.dev" style={{ color: '#d4b08c', textDecoration: 'none' }}>
            support@a2r.dev
          </a>
        </p>
      </section>
    </div>
  );

  // Extensions Panel - Extensions Management
  const renderExtensionsPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: '0 0 8px 0' }}>
              Extensions
            </h3>
            <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
              Allow A2R to directly interact with apps, data, and tools on your computer.
            </p>
          </div>
          <button style={{ 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#e5e5e5',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Browse extensions
          </button>
        </div>
      </section>

      {/* Empty State */}
      <section style={{ marginBottom: '32px' }}>
        <div style={{ 
          padding: '48px', 
          background: '#1f1f1f', 
          borderRadius: '12px',
          border: '1px dashed #333',
          textAlign: 'center'
        }}>
          <Puzzle size={48} color="#444" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            No extensions installed yet
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <button style={{ 
          padding: '10px 16px', 
          borderRadius: '6px', 
          border: '1px solid #444',
          background: 'transparent',
          color: '#e5e5e5',
          fontSize: '13px',
          cursor: 'pointer'
        }}>
          Advanced settings
        </button>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Extension Settings
        </h3>
        
        <ToggleItem
          label="Enable auto-updates for extensions"
          value={autoUpdateExtensions}
          onChange={setAutoUpdateExtensions}
          description="Automatically update extensions when new versions are available. If disabled, you'll need to manually update extensions."
        />
        
        <ToggleItem
          label="Use Built-in Node.js for MCP"
          value={useBuiltinNode}
          onChange={setUseBuiltinNode}
          description="If enabled, A2R will never use the system Node.js for extension MCP servers. This happens automatically when system's Node.js is missing or outdated."
        />
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Detected tools
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#888' }}>Node.js: </span>
            <span style={{ fontSize: '13px', color: '#fff' }}>22.20.0, 25.6.1 (built-in: 24.13.0)</span>
          </div>
          <div>
            <span style={{ fontSize: '13px', color: '#888' }}>Python: </span>
            <span style={{ fontSize: '13px', color: '#fff' }}>3.9.6, 3.14.2</span>
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Extension Developer
        </h3>
        
        <div style={{ 
          padding: '16px', 
          background: '#3d1f1f', 
          borderRadius: '8px',
          border: '1px solid #5d2f2f',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={20} color="#ff6b6b" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#ff6b6b', marginBottom: '4px' }}>
                Developer Tools Warning
              </div>
              <p style={{ fontSize: '12px', color: '#cc9999', margin: 0, lineHeight: '1.5' }}>
                These tools are intended for extension developers only. Using them incorrectly may cause extensions to malfunction or compromise your system security.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button style={{ 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: '1px solid #d4b08c',
            background: '#d4b08c',
            color: '#1a1a1a',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            Install Extension
          </button>
          <button style={{ 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#e5e5e5',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Install Unpacked Extension
          </button>
          <button style={{ 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#e5e5e5',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Open Extensions Folder
          </button>
          <button style={{ 
            padding: '8px 16px', 
            borderRadius: '6px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#e5e5e5',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Open Extension Settings Folder
          </button>
        </div>
      </section>
    </div>
  );

  // Billing Panel - Subscription & Billing
  const renderBillingPanel = () => (
    <div style={{ maxWidth: '600px' }}>
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Current Plan
        </h3>
        <div style={{ 
          padding: '24px', 
          background: 'linear-gradient(135deg, #252525 0%, #1f1f1f 100%)', 
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#d4b08c', marginBottom: '4px', fontWeight: '500' }}>
                Pro Plan
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff' }}>
                $20 <span style={{ fontSize: '14px', fontWeight: '400', color: '#888' }}>/ month</span>
              </div>
            </div>
            <span style={{ 
              padding: '4px 12px', 
              background: '#22c55e20', 
              borderRadius: '12px', 
              fontSize: '12px', 
              color: '#22c55e',
              fontWeight: '500'
            }}>
              Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 16px 0' }}>
            Your subscription renews on March 15, 2026
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: '1px solid #444',
              background: 'transparent',
              color: '#e5e5e5',
              fontSize: '13px',
              cursor: 'pointer'
            }}>
              Manage subscription
            </button>
            <button style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: 'none',
              background: '#d4b08c',
              color: '#1a1a1a',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Upgrade
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Usage
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#e5e5e5' }}>API Requests</span>
            <span style={{ fontSize: '13px', color: '#888' }}>12,450 / 50,000</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '25%', height: '100%', background: '#d4b08c', borderRadius: '3px' }} />
          </div>
        </div>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#e5e5e5' }}>Storage</span>
            <span style={{ fontSize: '13px', color: '#888' }}>2.1 GB / 10 GB</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: '21%', height: '100%', background: '#d4b08c', borderRadius: '3px' }} />
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
          Payment Method
        </h3>
        <div style={{ padding: '16px', background: '#252525', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '26px', background: '#333', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={16} color="#888" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#ffffff' }}>•••• •••• •••• 4242</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Expires 12/27</div>
          </div>
          <button style={{ 
            padding: '6px 12px', 
            borderRadius: '4px', 
            border: '1px solid #444',
            background: 'transparent',
            color: '#888',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            Update
          </button>
        </div>
      </section>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralPanel();
      case 'appearance':
        return renderAppearancePanel();
      case 'models':
        return renderModelsPanel();
      case 'api-keys':
        return renderApiKeysPanel();
      case 'shortcuts':
        return renderShortcutsPanel();
      case 'gizziio-code':
        return renderGizziioCodePanel();
      case 'cowork':
        return renderCoworkPanel();
      case 'extensions':
        return renderExtensionsPanel();
      case 'billing':
        return renderBillingPanel();
      case 'infrastructure':
        return renderInfrastructurePanel();
      case 'security':
        return renderSecurityPanel();
      case 'agents':
        return renderAgentsPanel();
      case 'about':
        return renderAboutPanel();
      case 'signin':
        return <ClerkAuthPanel />;
      case 'vps':
        return <VPSConnectionsPanel />;
      default:
        return null;
    }
  };

  const navigationItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode; group?: string }> = [
    // Account & Billing
    { id: 'signin', label: 'Sign In', icon: <User size={18} />, group: 'account' },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} />, group: 'account' },
    
    // Platform Settings
    { id: 'general', label: 'General', icon: <Settings size={18} />, group: 'platform' },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, group: 'platform' },
    { id: 'models', label: 'Models', icon: <Cpu size={18} />, group: 'platform' },
    { id: 'api-keys', label: 'API Keys', icon: <Key size={18} />, group: 'platform' },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={18} />, group: 'platform' },
    
    // Product Settings
    { id: 'gizziio-code', label: 'Gizziio Code', icon: <Code2 size={18} />, group: 'products' },
    { id: 'cowork', label: 'Cowork', icon: <Briefcase size={18} />, group: 'products' },
    { id: 'extensions', label: 'Extensions', icon: <Puzzle size={18} />, group: 'products' },
    
    // Infrastructure
    { id: 'vps', label: 'VPS Connections', icon: <Server size={18} />, group: 'infrastructure' },
    { id: 'infrastructure', label: 'Infrastructure', icon: <Cloud size={18} />, group: 'infrastructure' },
    { id: 'security', label: 'Security', icon: <Shield size={18} />, group: 'infrastructure' },
    { id: 'agents', label: 'Agents', icon: <Bot size={18} />, group: 'infrastructure' },
    
    // About
    { id: 'about', label: 'About', icon: <Info size={18} />, group: 'about' },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: '#1a1a1a',
      overflow: 'hidden'
    }}>
      {/* Left Column - Navigation (Claude Code Style) */}
      <div
        style={{
          width: '240px',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          padding: '32px 12px',
          overflowY: 'auto',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
        <div style={{ padding: '0 12px', marginBottom: '32px' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('a2r:close-settings'))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#c0c0c0',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '0',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#c0c0c0';
            }}
          >
            <span style={{ fontSize: '18px' }}>←</span>
            Settings
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Account Group */}
          <div style={{ marginBottom: '8px' }}>
            {navigationItems.filter(item => item.group === 'account').map((item) => (
              <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
          
          <div style={{ height: '1px', background: '#333', margin: '12px 0' }} />
          
          {/* Platform Group */}
          <div style={{ marginBottom: '8px' }}>
            {navigationItems.filter(item => item.group === 'platform').map((item) => (
              <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
          
          <div style={{ height: '1px', background: '#333', margin: '12px 0' }} />
          
          {/* Products Group */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Products
            </div>
            {navigationItems.filter(item => item.group === 'products').map((item) => (
              <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
          
          <div style={{ height: '1px', background: '#333', margin: '12px 0' }} />
          
          {/* Infrastructure Group */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Infrastructure
            </div>
            {navigationItems.filter(item => item.group === 'infrastructure').map((item) => (
              <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
          
          <div style={{ height: '1px', background: '#333', margin: '12px 0' }} />
          
          {/* About Group */}
          <div>
            {navigationItems.filter(item => item.group === 'about').map((item) => (
              <NavButton key={item.id} item={item} activeSection={activeSection} onClick={() => setActiveSection(item.id)} />
            ))}
          </div>
        </nav>
      </div>

      {/* Right Column - Content (Claude Code Style) */}
      <div style={{ 
        flex: 1, 
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a'
      }}>
        <div style={{ 
          padding: '48px 64px',
          maxWidth: '720px',
          minHeight: 'min-content',
          boxSizing: 'border-box',
          paddingBottom: '120px'
        }}>
          {/* Section Title */}
          <h1 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#ffffff',
            margin: '0 0 32px 0',
            letterSpacing: '-0.01em'
          }}>
            {navigationItems.find(item => item.id === activeSection)?.label}
          </h1>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

interface ToggleItemProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

interface NavButtonProps {
  item: { id: SettingsSection; label: string; icon: React.ReactNode; group?: string };
  activeSection: SettingsSection;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, activeSection, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      padding: '8px 12px',
      border: 'none',
      backgroundColor: activeSection === item.id ? '#2a2a2a' : 'transparent',
      color: activeSection === item.id ? '#ffffff' : '#a0a0a0',
      fontSize: '13px',
      fontWeight: '400',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'all 0.15s ease',
      textAlign: 'left',
      borderRadius: '6px',
      position: 'relative',
    }}
    onMouseEnter={(e) => {
      if (activeSection !== item.id) {
        e.currentTarget.style.backgroundColor = '#252525';
        e.currentTarget.style.color = '#e0e0e0';
      }
    }}
    onMouseLeave={(e) => {
      if (activeSection !== item.id) {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#a0a0a0';
      }
    }}
  >
    {activeSection === item.id && (
      <span 
        style={{
          position: 'absolute',
          left: '0',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '3px',
          height: '16px',
          backgroundColor: '#d4b08c',
          borderRadius: '0 2px 2px 0',
        }}
      />
    )}
    {item.label}
  </button>
);

const ToggleItem: React.FC<ToggleItemProps> = ({ label, value, onChange, description }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      marginBottom: '12px',
    }}
  >
    <div>
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff', marginBottom: '2px' }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: '12px', color: '#b0b0b0' }}>
          {description}
        </div>
      )}
    </div>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!value);
      }}
      style={{
        width: '48px',
        height: '28px',
        borderRadius: '14px',
        border: 'none',
        backgroundColor: value ? '#d4b08c' : 'var(--border-subtle)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.3s ease',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          position: 'absolute',
          left: value ? '2px' : '22px',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />
    </button>
  </div>
);

export default SettingsView;
