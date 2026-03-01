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
} from 'lucide-react';

type SettingsSection = 'general' | 'appearance' | 'models' | 'api-keys' | 'shortcuts' | 'about';
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
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
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
            color: 'var(--text-primary)',
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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
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
            color: 'var(--text-primary)',
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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
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
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
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
                color: 'var(--text-primary)',
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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
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
                color: 'var(--text-primary)',
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
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>
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
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
          Default Models
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                color: 'var(--text-primary)',
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
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                color: 'var(--text-primary)',
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
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                color: 'var(--text-primary)',
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
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
          Model Settings
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
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
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
              color: 'var(--text-primary)',
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
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
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
                  color: 'var(--text-secondary)',
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
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
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
          color: 'var(--text-secondary)',
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
              color: 'var(--text-primary)',
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            Action
          </div>
          <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
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
                color: 'var(--text-primary)',
                borderRight: '1px solid var(--border-subtle)',
              }}
            >
              {item.action}
            </div>
            <div
              style={{
                padding: '12px 16px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
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
            color: 'var(--text-primary)',
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
        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '8px' }}>
          v0.9.1-beta
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
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
      case 'about':
        return renderAboutPanel();
      default:
        return null;
    }
  };

  const navigationItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'General', icon: <Settings size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'models', label: 'Models', icon: <Cpu size={18} /> },
    { id: 'api-keys', label: 'API Keys', icon: <Key size={18} /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={18} /> },
    { id: 'about', label: 'About', icon: <Info size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Left Column - Navigation */}
      <div
        style={{
          width: '220px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          padding: '24px 0',
          overflowY: 'auto',
        }}
      >
        <div style={{ paddingX: '16px', marginBottom: '20px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: 0,
              padding: '0 16px',
            }}
          >
            Settings
          </h2>
        </div>

        <nav>
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                backgroundColor: activeSection === item.id ? 'rgba(212, 176, 140, 0.1)' : 'transparent',
                color: activeSection === item.id ? '#d4b08c' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: activeSection === item.id ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderLeft: activeSection === item.id ? '3px solid #d4b08c' : '3px solid transparent',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (activeSection !== item.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Column - Content */}
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        <GlassSurface>
          <div style={{ padding: '0' }}>
            {renderContent()}
          </div>
        </GlassSurface>
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
      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>
        {label}
      </div>
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
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
