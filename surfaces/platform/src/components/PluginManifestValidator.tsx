/**
 * Plugin Manifest Validator
 *
 * Validates plugin.json and marketplace.json files against Zod schemas.
 * Supports drag-and-drop, file picker, text paste, and GitHub URL loading.
 *
 * @example
 * ```tsx
 * import PluginManifestValidator from './PluginManifestValidator';
 *
 * function App() {
 *   return <PluginManifestValidator />;
 * }
 * ```
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  UploadSimple,
  FileCode,
  CheckCircle,
  XCircle,
  Warning,
  Copy,
  ArrowSquareOut,
  GithubLogo as Github,
  FileText,
  CaretDown,
  CaretRight,
  Sparkle,
  ArrowsClockwise,
  DownloadSimple,
  MagicWand,
} from '@phosphor-icons/react';
import {
  validatePluginManifestV1,
  validateMarketplaceManifestV1,
  type ValidationResult,
  type PluginManifestV1,
  type PluginMarketplaceManifestV1,
} from '../plugins/pluginStandards';

// ============================================================================
// Theme - Matches A2R dark theme
// ============================================================================

const THEME = {
  bg: '#0c0a09',
  bgDeep: '#080706',
  bgElevated: '#1c1917',
  bgGlass: 'rgba(28, 25, 23, 0.85)',
  cardSurface: 'rgba(21, 18, 16, 0.82)',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.3)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

// ============================================================================
// Types
// ============================================================================

export type ManifestType = 'plugin' | 'marketplace' | 'unknown';
export type ValidatorTab = 'plugin' | 'marketplace';

export interface ValidationIssue {
  path: string;
  message: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationDetails {
  valid: boolean;
  type: ManifestType;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  manifest: unknown;
  formattedJson: string;
}

export interface PluginManifestValidatorProps {
  /** Initial JSON content to validate */
  initialContent?: string;
  /** Callback when validation results change */
  onValidationChange?: (details: ValidationDetails | null) => void;
  /** Compact mode for embedding in other components */
  compact?: boolean;
  /** Hide the title/header */
  hideHeader?: boolean;
  /** Custom class name */
  className?: string;
  /** Default active tab */
  defaultTab?: ValidatorTab;
}

// ============================================================================
// Utility Functions
// ============================================================================

function detectManifestType(json: unknown): ManifestType {
  if (typeof json !== 'object' || json === null) return 'unknown';
  const obj = json as Record<string, unknown>;

  // Check for marketplace manifest indicators
  if (Array.isArray(obj.plugins) && obj.owner && typeof obj.owner === 'object') {
    return 'marketplace';
  }

  // Check for plugin manifest indicators
  if (obj.name && obj.description && obj.version) {
    return 'plugin';
  }

  return 'unknown';
}

function findLineNumber(jsonString: string, path: string): number | undefined {
  const parts = path.split('.');
  const lines = jsonString.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this line contains the property we're looking for
    for (const part of parts) {
      if (line.includes(`"${part}"`)) {
        return i + 1;
      }
    }
  }
  return undefined;
}

function getFixSuggestion(error: string, path: string): string | undefined {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('required')) {
    return `Add the "${path}" field to your manifest`;
  }
  if (lowerError.includes('email')) {
    return 'Use a valid email format (e.g., user@example.com)';
  }
  if (lowerError.includes('url')) {
    return 'Use a valid URL format (e.g., https://example.com)';
  }
  if (lowerError.includes('non-empty')) {
    return 'Provide a non-empty string value';
  }
  if (lowerError.includes('max')) {
    return 'Reduce the length of this value';
  }
  if (lowerError.includes('repo') && lowerError.includes('github')) {
    return 'Add a "repo" field with format: owner/repository';
  }
  if (path.includes('version')) {
    return 'Use semantic versioning (e.g., 1.0.0)';
  }

  return undefined;
}

function validateWithDetails(content: string, forcedType?: ManifestType): ValidationDetails {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const parseError = e instanceof Error ? e.message : 'Invalid JSON';
    return {
      valid: false,
      type: 'unknown',
      errors: [{ path: 'root', message: parseError }],
      warnings: [],
      manifest: null,
      formattedJson: content,
    };
  }

  const detectedType = forcedType || detectManifestType(parsed);
  let result: ValidationResult;

  switch (detectedType) {
    case 'plugin':
      result = validatePluginManifestV1(parsed);
      break;
    case 'marketplace':
      result = validateMarketplaceManifestV1(parsed);
      break;
    default:
      // Try both validations
      const pluginResult = validatePluginManifestV1(parsed);
      if (pluginResult.valid) {
        result = pluginResult;
      } else {
        const marketplaceResult = validateMarketplaceManifestV1(parsed);
        if (marketplaceResult.valid) {
          result = marketplaceResult;
        } else {
          // Return plugin errors as they're more common
          result = pluginResult;
        }
      }
  }

  const formattedJson = JSON.stringify(parsed, null, 2);

  // Parse errors and add line numbers + suggestions
  const errors: ValidationIssue[] = result.errors.map((error) => {
    const path = error.split(':')[0] || 'unknown';
    const message = error.includes(':') ? error.split(':').slice(1).join(':').trim() : error;
    return {
      path,
      message,
      line: findLineNumber(formattedJson, path),
      suggestion: getFixSuggestion(message, path),
    };
  });

  // Generate warnings for recommended fields
  const warnings: ValidationIssue[] = [];
  const obj = parsed as Record<string, unknown>;

  if (detectedType === 'plugin' || detectedType === 'unknown') {
    if (!obj.author) {
      warnings.push({
        path: 'author',
        message: 'Author is recommended for attribution',
        suggestion: 'Add "author": "Your Name" or {"name": "Your Name", "email": "you@example.com"}',
      });
    }
    if (!obj.license) {
      warnings.push({
        path: 'license',
        message: 'License is recommended for open source distribution',
        suggestion: 'Add "license": "MIT" (or your preferred license)',
      });
    }
    if (!obj.tags && !obj.keywords) {
      warnings.push({
        path: 'tags',
        message: 'Tags or keywords help with discoverability',
        suggestion: 'Add "tags": ["tag1", "tag2"] for better searchability',
      });
    }
    if (!obj.homepage && !obj.repository) {
      warnings.push({
        path: 'homepage',
        message: 'Homepage or repository URL is recommended',
        suggestion: 'Add "homepage" or "repository" for users to learn more',
      });
    }
  }

  if (detectedType === 'marketplace' || detectedType === 'unknown') {
    const metadata = obj.metadata as Record<string, unknown> | undefined;
    if (!metadata?.description) {
      warnings.push({
        path: 'metadata.description',
        message: 'Marketplace description is recommended',
        suggestion: 'Add metadata.description to describe your marketplace',
      });
    }
  }

  return {
    valid: result.valid && errors.length === 0,
    type: detectedType,
    errors,
    warnings,
    manifest: parsed,
    formattedJson,
  };
}

function generateCorrectedManifest(details: ValidationDetails): string {
  if (!details.manifest) return '';

  const manifest = { ...(details.manifest as Record<string, unknown>) };

  // Add missing required fields with placeholder values
  for (const error of details.errors) {
    const path = error.path;
    if (path === 'name' && !manifest.name) manifest.name = 'my-plugin';
    if (path === 'description' && !manifest.description) manifest.description = 'Plugin description';
    if (path === 'version' && !manifest.version) manifest.version = '1.0.0';
    if (path === 'owner.name' && !manifest.owner) {
      manifest.owner = { name: 'Your Name' };
    }
    if (path === 'plugins' && !Array.isArray(manifest.plugins)) {
      manifest.plugins = [];
    }
  }

  return JSON.stringify(manifest, null, 2);
}

function formatJson(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  onTextDrop: (text: string) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  compact?: boolean;
}

function DropZone({ onFileDrop, onTextDrop, isDragging, setIsDragging, compact }: DropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Handle dropped files
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        onFileDrop(file);
      }
    }

    // Handle dropped text/URLs
    const text = e.dataTransfer.getData('text');
    if (text) {
      onTextDrop(text);
    }
  }, [onFileDrop, onTextDrop, setIsDragging]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
  }, [onFileDrop]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? THEME.accent : THEME.borderStrong}`,
        borderRadius: 12,
        padding: compact ? 24 : 32,
        textAlign: 'center',
        cursor: 'pointer',
        background: isDragging ? THEME.accentMuted : 'transparent',
        transition: 'all 0.2s ease',
      }}
      data-testid="drop-zone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        data-testid="file-input"
      />
      <UploadSimple
        size={compact ? 32 : 40}
        color={isDragging ? THEME.accent : THEME.textTertiary}
        style={{ marginBottom: 12 }}
      />
      <div style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        Drop JSON file here or click to browse
      </div>
      <div style={{ color: THEME.textTertiary, fontSize: 12 }}>
        Supports plugin.json and marketplace.json
      </div>
    </div>
  );
}

interface UrlInputProps {
  onLoad: (url: string) => void;
  loading: boolean;
}

function UrlInput({ onLoad, loading }: UrlInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onLoad(url.trim());
    }
  }, [url, onLoad]);

  const isGitHubUrl = url.includes('github.com') || url.includes('raw.githubusercontent.com');

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Github
          size={16}
          color={isGitHubUrl ? THEME.accent : THEME.textTertiary}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://raw.githubusercontent.com/.../plugin.json"
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: THEME.bgElevated,
            color: THEME.textPrimary,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !url.trim()}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: THEME.accent,
          color: '#1a1917',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {loading ? <ArrowsClockwise size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowSquareOut size={14} />}
        Load
      </button>
    </form>
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || `// Paste your plugin.json or marketplace.json content here\n{\n  "name": "my-plugin",\n  "description": "A great plugin",\n  "version": "1.0.0"\n}`}
      style={{
        width: '100%',
        minHeight: 200,
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${THEME.border}`,
        background: THEME.bgElevated,
        color: THEME.textPrimary,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: 1.5,
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
      }}
      spellCheck={false}
      data-testid="json-textarea"
    />
  );
}

interface ValidationResultProps {
  details: ValidationDetails;
  onCopyCorrected: () => void;
  onCopyFormatted: () => void;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}

function ValidationResultPanel({
  details,
  onCopyCorrected,
  onCopyFormatted,
  expandedSections,
  onToggleSection,
}: ValidationResultProps) {
  const { valid, type, errors, warnings, formattedJson } = details;

  const typeLabel = type === 'plugin' ? 'Plugin Manifest' : type === 'marketplace' ? 'Marketplace Manifest' : 'Unknown Type';
  const typeColor = type === 'plugin' ? THEME.info : type === 'marketplace' ? THEME.warning : THEME.textTertiary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 8,
          background: valid ? 'rgba(34, 197, 94, 0.1)' : errors.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${valid ? 'rgba(34, 197, 94, 0.2)' : errors.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        }}
        data-testid="validation-status"
      >
        {valid ? (
          <CheckCircle size={24} color={THEME.success} />
        ) : errors.length > 0 ? (
          <XCircle size={24} color={THEME.danger} />
        ) : (
          <Warning size={24} color={THEME.warning} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: valid ? THEME.success : errors.length > 0 ? THEME.danger : THEME.warning }}>
            {valid ? 'Valid manifest' : errors.length > 0 ? 'Validation failed' : 'Valid with warnings'}
          </div>
          <div style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 2 }}>
            {typeLabel} • {errors.length} error{errors.length !== 1 ? 's' : ''} • {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            background: typeColor + '20',
            color: typeColor,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {type}
        </span>
      </div>

      {/* Errors Section */}
      {errors.length > 0 && (
        <CollapsibleSection
          title="Errors"
          icon={<XCircle size={16} color={THEME.danger} />}
          count={errors.length}
          isExpanded={expandedSections.errors}
          onToggle={() => onToggleSection('errors')}
          color={THEME.danger}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {errors.map((error, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <code style={{ fontSize: 12, color: THEME.danger, fontWeight: 600 }}>
                    {error.path}
                  </code>
                  {error.line && (
                    <span style={{ fontSize: 11, color: THEME.textTertiary }}>
                      Line {error.line}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: THEME.textPrimary }}>{error.message}</div>
                {error.suggestion && (
                  <div style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 6, fontStyle: 'italic' }}>
                    💡 {error.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <CollapsibleSection
          title="Warnings"
          icon={<Warning size={16} color={THEME.warning} />}
          count={warnings.length}
          isExpanded={expandedSections.warnings}
          onToggle={() => onToggleSection('warnings')}
          color={THEME.warning}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map((warning, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                }}
              >
                <code style={{ fontSize: 12, color: THEME.warning, fontWeight: 600 }}>
                  {warning.path}
                </code>
                <div style={{ fontSize: 13, color: THEME.textPrimary, marginTop: 4 }}>
                  {warning.message}
                </div>
                {warning.suggestion && (
                  <div style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 6, fontStyle: 'italic' }}>
                    💡 {warning.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Formatted Preview */}
      <CollapsibleSection
        title="Formatted Preview"
        icon={<FileText size={16} color={THEME.textSecondary} />}
        isExpanded={expandedSections.preview}
        onToggle={() => onToggleSection('preview')}
        color={THEME.textSecondary}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {!valid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyCorrected();
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: `1px solid ${THEME.border}`,
                  background: 'transparent',
                  color: THEME.textSecondary,
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkle size={12} />
                Copy Fixed
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyFormatted();
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: `1px solid ${THEME.border}`,
                background: 'transparent',
                color: THEME.textSecondary,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Copy size={12} />
              Copy JSON
            </button>
          </div>
        }
      >
        <pre
          style={{
            margin: 0,
            padding: 16,
            background: THEME.bgDeep,
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            color: THEME.textPrimary,
            maxHeight: 400,
          }}
        >
          <code>{formattedJson}</code>
        </pre>
      </CollapsibleSection>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  count,
  isExpanded,
  onToggle,
  color,
  children,
  actions,
}: CollapsibleSectionProps) {
  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
        }}
      >
        <button
          onClick={onToggle}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: THEME.textPrimary,
            padding: 0,
            fontSize: 14,
            fontWeight: 500,
            textAlign: 'left',
          }}
        >
          {isExpanded ? <CaretDown size={16} color={THEME.textSecondary} /> : <CaretRight size={16} color={THEME.textSecondary} />}
          {icon}
          <span>{title}</span>
          {count !== undefined && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 10,
                background: color + '20',
                color: color,
                fontSize: 11,
                fontWeight: 600,
                marginLeft: 8,
              }}
            >
              {count}
            </span>
          )}
        </button>
        {actions && <div>{actions}</div>}
      </div>
      {isExpanded && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PluginManifestValidator({
  initialContent,
  onValidationChange,
  compact,
  hideHeader,
  className,
  defaultTab = 'plugin',
}: PluginManifestValidatorProps) {
  const [activeTab, setActiveTab] = useState<ValidatorTab>(defaultTab);
  const [content, setContent] = useState(initialContent || '');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationDetails, setValidationDetails] = useState<ValidationDetails | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    errors: true,
    warnings: true,
    preview: false,
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Validate content when it changes
  useEffect(() => {
    if (content.trim()) {
      const details = validateWithDetails(content, activeTab);
      setValidationDetails(details);
      onValidationChange?.(details);
    } else {
      setValidationDetails(null);
      onValidationChange?.(null);
    }
  }, [content, activeTab, onValidationChange]);

  // Load initial content
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleFileDrop = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setContent(text);
    } catch (e) {
      console.error('Failed to read file:', e);
    }
  }, []);

  const handleTextDrop = useCallback((text: string) => {
    // Check if it's a URL
    if (text.startsWith('http')) {
      handleLoadFromUrl(text);
    } else {
      setContent(text);
    }
  }, []);

  const handleLoadFromUrl = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      setContent(text);
    } catch (e) {
      console.error('Failed to load from URL:', e);
      setContent(`// Error loading from URL: ${e instanceof Error ? e.message : 'Unknown error'}\n// URL: ${url}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopyCorrected = useCallback(() => {
    if (validationDetails) {
      const corrected = generateCorrectedManifest(validationDetails);
      navigator.clipboard.writeText(corrected);
      setCopyFeedback('Fixed manifest copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [validationDetails]);

  const handleCopyFormatted = useCallback(() => {
    if (validationDetails) {
      navigator.clipboard.writeText(validationDetails.formattedJson);
      setCopyFeedback('Formatted JSON copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [validationDetails]);

  const handleToggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section as keyof typeof prev] }));
  }, []);

  const handleClear = useCallback(() => {
    setContent('');
    setValidationDetails(null);
  }, []);

  const handleFormatJson = useCallback(() => {
    if (content.trim()) {
      const formatted = formatJson(content);
      setContent(formatted);
    }
  }, [content]);

  const handleLoadExample = useCallback((type: ValidatorTab) => {
    if (type === 'plugin') {
      const example = {
        $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
        name: 'example-plugin',
        description: 'An example plugin manifest',
        version: '1.0.0',
        author: {
          name: 'Your Name',
          email: 'you@example.com',
        },
        license: 'MIT',
        tags: ['example', 'plugin'],
        keywords: ['claude', 'automation'],
        commands: ['/example'],
        skills: ['example-skill'],
      };
      setContent(JSON.stringify(example, null, 2));
    } else {
      const example = {
        $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
        name: 'example-marketplace',
        owner: {
          name: 'Your Organization',
          email: 'contact@example.com',
        },
        metadata: {
          version: '1.0.0',
          description: 'An example marketplace manifest',
        },
        plugins: [
          {
            name: 'example-plugin',
            description: 'An example plugin',
            version: '1.0.0',
            source: {
              source: 'github',
              repo: 'owner/example-plugin',
            },
          },
        ],
      };
      setContent(JSON.stringify(example, null, 2));
    }
  }, []);

  const getPlaceholder = (type: ValidatorTab): string => {
    if (type === 'plugin') {
      return `// Paste your plugin.json content here
{
  "name": "my-plugin",
  "description": "A great plugin",
  "version": "1.0.0"
}`;
    }
    return `// Paste your marketplace.json content here
{
  "name": "my-marketplace",
  "owner": { "name": "Owner" },
  "plugins": []
}`;
  };

  return (
    <div
      className={className}
      style={{
        background: THEME.bg,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      {!hideHeader && (
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${THEME.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: THEME.bgElevated,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCode size={20} color={THEME.accent} />
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: THEME.textPrimary }}>
                Plugin Manifest Validator
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: THEME.textSecondary }}>
                Validate plugin.json and marketplace.json files
              </p>
            </div>
          </div>
          {content && (
            <button
              onClick={handleClear}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${THEME.border}`,
                background: 'transparent',
                color: THEME.textSecondary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${THEME.border}` }}>
        <button
          onClick={() => {
            setActiveTab('plugin');
            setContent('');
          }}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: activeTab === 'plugin' ? THEME.accentMuted : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'plugin' ? THEME.accent : 'transparent'}`,
            color: activeTab === 'plugin' ? THEME.accent : THEME.textSecondary,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          data-testid="tab-plugin"
        >
          <FileCode size={16} />
          Validate Plugin
        </button>
        <button
          onClick={() => {
            setActiveTab('marketplace');
            setContent('');
          }}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: activeTab === 'marketplace' ? THEME.accentMuted : 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'marketplace' ? THEME.accent : 'transparent'}`,
            color: activeTab === 'marketplace' ? THEME.accent : THEME.textSecondary,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          data-testid="tab-marketplace"
        >
          <UploadSimple size={16} />
          Validate Marketplace
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: compact ? 16 : 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop Zone */}
          <DropZone
            onFileDrop={handleFileDrop}
            onTextDrop={handleTextDrop}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            compact={compact}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: THEME.border }} />
            <span style={{ fontSize: 12, color: THEME.textTertiary }}>OR</span>
            <div style={{ flex: 1, height: 1, background: THEME.border }} />
          </div>

          {/* URL Input */}
          <UrlInput onLoad={handleLoadFromUrl} loading={loading} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: THEME.border }} />
            <span style={{ fontSize: 12, color: THEME.textTertiary }}>OR</span>
            <div style={{ flex: 1, height: 1, background: THEME.border }} />
          </div>

          {/* Text Editor */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: THEME.textPrimary }}>
                {activeTab === 'plugin' ? 'Plugin Manifest JSON' : 'Marketplace Manifest JSON'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleFormatJson}
                  disabled={!content.trim()}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${THEME.border}`,
                    background: 'transparent',
                    color: THEME.textSecondary,
                    fontSize: 11,
                    cursor: content.trim() ? 'pointer' : 'not-allowed',
                    opacity: content.trim() ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Format JSON"
                  data-testid="format-button"
                >
                  <MagicWand size={12} />
                  Format JSON
                </button>
                <button
                  onClick={() => handleLoadExample(activeTab)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: `1px solid ${THEME.border}`,
                    background: 'transparent',
                    color: THEME.textSecondary,
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  data-testid="example-button"
                >
                  <DownloadSimple size={12} />
                  Example
                </button>
              </div>
            </div>
            <TextInput 
              value={content} 
              onChange={setContent} 
              placeholder={getPlaceholder(activeTab)}
            />
          </div>

          {/* Validation Results */}
          {validationDetails && content.trim() && (
            <ValidationResultPanel
              details={validationDetails}
              onCopyCorrected={handleCopyCorrected}
              onCopyFormatted={handleCopyFormatted}
              expandedSections={expandedSections}
              onToggleSection={handleToggleSection}
            />
          )}
        </div>
      </div>

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: THEME.bgElevated,
            border: `1px solid ${THEME.border}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'slideIn 0.2s ease',
            zIndex: 1000,
          }}
        >
          <CheckCircle size={16} color={THEME.success} />
          <span style={{ fontSize: 13, color: THEME.textPrimary }}>{copyFeedback}</span>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default PluginManifestValidator;
