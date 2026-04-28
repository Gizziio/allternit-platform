/**
 * AddSSHConnectionForm - Claude Code style SSH connection setup
 */

"use client";

import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Terminal,
  Key,
  HardDrives,
  CheckCircle,
  Warning,
  CircleNotch,
  Eye,
  EyeSlash,
  FileLock as FileKey,
  UploadSimple,
  Shield,
} from '@phosphor-icons/react';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

export interface SSHConnectionFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'key' | 'password';
  privateKey: string;
  privateKeyPath: string;
  password: string;
}

export interface SSHConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    os?: string;
    architecture?: string;
    dockerInstalled?: boolean;
    allternitInstalled?: boolean;
  };
}

export interface AddSSHConnectionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SSHConnectionFormData) => Promise<void>;
  onTest?: (data: SSHConnectionFormData) => Promise<SSHConnectionTestResult>;
  defaultValues?: Partial<SSHConnectionFormData>;
}

export function AddSSHConnectionForm({
  isOpen,
  onClose,
  onSubmit,
  onTest,
  defaultValues,
}: AddSSHConnectionFormProps) {
  const [formData, setFormData] = useState<SSHConnectionFormData>({
    name: defaultValues?.name || '',
    host: defaultValues?.host || '',
    port: defaultValues?.port || 22,
    username: defaultValues?.username || 'root',
    authType: defaultValues?.authType || 'key',
    privateKey: defaultValues?.privateKey || '',
    privateKeyPath: defaultValues?.privateKeyPath || '~/.ssh/id_rsa',
    password: defaultValues?.password || '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<SSHConnectionTestResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SSHConnectionFormData, string>>>({});
  const [activeTab, setActiveTab] = useState<'form' | 'help'>('form');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback(<K extends keyof SSHConnectionFormData>(
    field: K,
    value: SSHConnectionFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (testResult) setTestResult(null);
  }, [errors, testResult]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof SSHConnectionFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.host.trim()) newErrors.host = 'Host is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (formData.authType === 'password' && !formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, validateForm]);

  const handleTest = useCallback(async () => {
    if (!onTest || !validateForm()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(formData);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  }, [formData, onTest, validateForm]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleInputChange('privateKey', content);
        handleInputChange('privateKeyPath', file.name);
      }
    };
    reader.readAsText(file);
  }, [handleInputChange]);

  const handleClose = useCallback(() => {
    setFormData({
      name: '',
      host: '',
      port: 22,
      username: 'root',
      authType: 'key',
      privateKey: '',
      privateKeyPath: '~/.ssh/id_rsa',
      password: '',
    });
    setErrors({});
    setTestResult(null);
    setActiveTab('form');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Styles matching the HTML preview exactly
  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--shell-overlay-backdrop)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001,
      padding: '20px',
    },
    modal: {
      width: '100%',
      maxWidth: '512px',
      maxHeight: '90vh',
      background: 'rgba(20,20,20,0.95)',
      border: '1px solid #333',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 24px 80px var(--shell-overlay-backdrop)',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid #333',
    },
    iconBox: {
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${STATUS.info}33, rgba(147,51,234,0.2))`,
      border: `1px solid ${STATUS.info}4c`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: TEXT.secondary,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      display: 'flex',
      borderBottom: '1px solid #333',
    },
    tab: {
      flex: 1,
      padding: '12px',
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: 500,
      background: 'transparent',
      border: 'none',
      color: TEXT.secondary,
      cursor: 'pointer',
    },
    tabActive: {
      color: SAND[500],
      borderBottom: '2px solid #d4b08c',
    },
    body: {
      padding: '24px',
      maxHeight: 'calc(90vh - 140px)',
      overflowY: 'auto',
    },
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      fontWeight: 500,
      marginBottom: '6px',
      color: TEXT.primary,
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '8px',
      border: '1px solid #444',
      background: 'var(--surface-panel)',
      color: TEXT.primary,
      fontSize: '13px',
      outline: 'none',
    },
    hint: {
      fontSize: '11px',
      color: TEXT.tertiary,
      marginTop: '4px',
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    },
    authToggle: {
      display: 'flex',
      gap: '8px',
      padding: '4px',
      background: 'var(--surface-panel)',
      borderRadius: '8px',
      border: '1px solid #333',
    },
    authOption: {
      flex: 1,
      padding: '8px',
      borderRadius: '6px',
      border: 'none',
      background: 'transparent',
      color: TEXT.secondary,
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
    },
    authOptionActive: {
      background: `${SAND[500]}33`,
      color: SAND[500],
    },
    actions: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px',
    },
    btnSecondary: {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      background: 'var(--surface-panel)',
      color: TEXT.primary,
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    btnPrimary: {
      flex: 1,
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      background: SAND[500],
      color: 'var(--ui-text-inverse)',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
    },
    testResult: {
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid',
      marginTop: '16px',
    },
  };

  return createPortal(
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.iconBox}>
              <Terminal size={20} color={STATUS.info} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: TEXT.primary }}>Add SSH Connection</h2>
              <p style={{ fontSize: '12px', color: TEXT.secondary }}>Connect to a remote machine to run Allternit</p>
            </div>
          </div>
          <button 
            style={styles.closeBtn} 
            onClick={handleClose}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-panel)'; e.currentTarget.style.color = 'var(--ui-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-muted)'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'form' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('form')}
          >
            Connection
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'help' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('help')}
          >
            Setup Guide
          </button>
        </div>

        {/* Content */}
        <div style={styles.body}>
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <HardDrives size={14} color="#888" />
                  Name
                </label>
                <input
                  type="text"
                  style={{ ...styles.input, borderColor: errors.name ? STATUS.error : 'var(--ui-border-default)' }}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My Server"
                />
                {errors.name ? (
                  <p style={{ ...styles.hint, color: STATUS.error }}>{errors.name}</p>
                ) : (
                  <p style={styles.hint}>A friendly name for this SSH connection</p>
                )}
              </div>

              {/* SSH Host */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <Terminal size={14} color="#888" />
                  SSH Host
                </label>
                <input
                  type="text"
                  style={{ ...styles.input, borderColor: errors.host ? STATUS.error : 'var(--ui-border-default)' }}
                  value={formData.host}
                  onChange={(e) => handleInputChange('host', e.target.value)}
                  placeholder="user@hostname"
                />
                {errors.host ? (
                  <p style={{ ...styles.hint, color: STATUS.error }}>{errors.host}</p>
                ) : (
                  <p style={styles.hint}>user@myserver.com or a host from ~/.ssh/config</p>
                )}
              </div>

              {/* Port & Username */}
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>SSH Port</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
                    placeholder="22"
                  />
                  <p style={styles.hint}>Leave empty for default (22)</p>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    style={{ ...styles.input, borderColor: errors.username ? STATUS.error : 'var(--ui-border-default)' }}
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="root"
                  />
                  {errors.username && <p style={{ ...styles.hint, color: STATUS.error }}>{errors.username}</p>}
                </div>
              </div>

              {/* Auth Type */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <Key size={14} color="#888" />
                  Authentication
                </label>
                <div style={styles.authToggle}>
                  <button
                    type="button"
                    style={{ ...styles.authOption, ...(formData.authType === 'key' ? styles.authOptionActive : {}) }}
                    onClick={() => handleInputChange('authType', 'key')}
                  >
                    <FileKey size={16} />
                    SSH Key
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.authOption, ...(formData.authType === 'password' ? styles.authOptionActive : {}) }}
                    onClick={() => handleInputChange('authType', 'password')}
                  >
                    <Shield size={16} />
                    Password
                  </button>
                </div>
              </div>

              {/* Key Auth */}
              {formData.authType === 'key' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Identity File (Private Key)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        style={styles.input}
                        value={formData.privateKeyPath}
                        onChange={(e) => handleInputChange('privateKeyPath', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                      />
                      <input ref={fileInputRef} type="file" accept=".pem,.key,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                      <button
                        type="button"
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--ui-border-default)', background: 'var(--surface-panel)', color: TEXT.primary, cursor: 'pointer' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadSimple size={16} />
                      </button>
                    </div>
                    <p style={styles.hint}>Leave empty to use default SSH key or SSH config</p>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Or paste private key</label>
                    <textarea
                      style={{ ...styles.input, minHeight: '100px', fontFamily: 'monospace', fontSize: '12px', resize: 'none' }}
                      value={formData.privateKey}
                      onChange={(e) => handleInputChange('privateKey', e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      rows={4}
                    />
                  </div>
                </>
              )}

              {/* Password Auth */}
              {formData.authType === 'password' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      style={{ ...styles.input, borderColor: errors.password ? STATUS.error : 'var(--ui-border-default)', paddingRight: '40px' }}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter SSH password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: TEXT.secondary, cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p style={{ ...styles.hint, color: STATUS.error }}>{errors.password}</p>}
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div
                  style={{
                    ...styles.testResult,
                    background: testResult.success ? `${STATUS.success}1a` : 'var(--status-error-bg)',
                    borderColor: testResult.success ? `${STATUS.success}4c` : 'color-mix(in srgb, var(--status-error) 30%, transparent)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {testResult.success ? (
                      <CheckCircle size={20} color={STATUS.success} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <Warning size={20} color={STATUS.error} style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: testResult.success ? STATUS.success : STATUS.error }}>
                        {testResult.success ? 'Connection successful' : 'Connection failed'}
                      </p>
                      <p style={{ fontSize: '12px', color: TEXT.secondary, marginTop: '4px' }}>{testResult.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={styles.actions}>
                {onTest && (
                  <button
                    type="button"
                    style={{ ...styles.btnSecondary, opacity: isTesting ? 0.6 : 1 }}
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? <CircleNotch size={16} className="animate-spin" /> : 'Test Connection'}
                  </button>
                )}
                <button type="submit" style={{ ...styles.btnPrimary, opacity: isSubmitting ? 0.6 : 1 }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Add SSH Connection
                </button>
              </div>
            </form>
          ) : (
            /* Help Tab */
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px`, background: ${STATUS.info}33, display: `flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: STATUS.info, flexShrink: 0 }}>1</div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 500, color: TEXT.primary, marginBottom: '4px' }}>Get your VPS ready</h4>
                  <p style={{ fontSize: '12px', color: TEXT.secondary }}>Ensure you have a VPS with SSH access enabled.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px`, background: ${STATUS.info}33, display: `flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: STATUS.info, flexShrink: 0 }}>2</div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 500, color: TEXT.primary, marginBottom: '4px' }}>Generate SSH keys</h4>
                  <p style={{ fontSize: '12px', color: TEXT.secondary }}>If needed, run:</p>
                  <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--surface-panel)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: SAND[500] }}>
                    ssh-keygen -t ed25519 -C "allternit-email.com"
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px`, background: ${STATUS.info}33, display: `flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: STATUS.info, flexShrink: 0 }}>3</div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 500, color: TEXT.primary, marginBottom: '4px' }}>Copy your public key</h4>
                  <p style={{ fontSize: '12px', color: TEXT.secondary }}>Run this to authorize your key:</p>
                  <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--surface-panel)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: SAND[500] }}>
                    ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '16px', padding: '12px`, background: ${STATUS.warning}1a, border: `1px solid `${STATUS.warning}4c`', borderRadius: '8px', display: 'flex', gap: '10px' }}>
                <Warning size={20} color={STATUS.warning} style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: STATUS.warning }}>Security tip</p>
                  <p style={{ fontSize: '11px', color: TEXT.secondary, marginTop: '2px' }}>Allternit stores keys encrypted and only uses them for SSH connections.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AddSSHConnectionForm;
