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
import { SAND, STATUS, TEXT } from '@/design/allternit.tokens';
import { cn } from '@/lib/utils';

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

  return createPortal(
    <div 
      role="button" tabIndex={0} 
      className="fixed inset-0 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm flex items-center justify-center z-[1001] p-5 outline-none" 
      onClick={handleClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClose(); }}
    >
      <div 
        role="button" tabIndex={0} 
        className="w-full max-w-[512px] max-h-[90vh] bg-[rgba(20,20,20,0.95)] border border-solid border-[#333] rounded-2xl overflow-hidden shadow-[0_24px_80px_var(--shell-overlay-backdrop)] flex flex-col outline-none" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-solid border-[#333]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--status-info)]/20 to-purple-500/20 border border-solid border-[var(--status-info)]/30 flex items-center justify-center">
              <Terminal size={20} className="text-[var(--status-info)]" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ui-text-primary)] m-0">Add SSH Connection</h2>
              <p className="text-[12px] text-[var(--ui-text-secondary)] m-0">Connect to a remote machine to run Allternit</p>
            </div>
          </div>
          <button type="button" 
            onClick={handleClose}
            className="size-8 rounded-lg border-none bg-transparent text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[var(--surface-panel)] hover:text-[var(--ui-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-solid border-[#333]">
          <button type="button"
            className={cn(
              "flex-1 p-3 text-center text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors",
              activeTab === 'form' ? "text-[var(--accent-primary)] border-b-2 border-solid border-[var(--accent-primary)]" : "text-[var(--ui-text-secondary)] border-b-2 border-transparent"
            )}
            onClick={() => setActiveTab('form')}
          >
            Connection
          </button>
          <button type="button"
            className={cn(
              "flex-1 p-3 text-center text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors",
              activeTab === 'help' ? "text-[var(--accent-primary)] border-b-2 border-solid border-[var(--accent-primary)]" : "text-[var(--ui-text-secondary)] border-b-2 border-transparent"
            )}
            onClick={() => setActiveTab('help')}
          >
            Setup Guide
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'form' ? (
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">
                  <HardDrives size={14} className="text-[#888]" />
                  Name
                </div>
                <input aria-label="Input" type="text"
                  className={cn(
                    "w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]",
                    errors.name ? "border-[var(--status-error)]" : "border-[#444]"
                  )}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="My Server"
                />
                {errors.name ? (
                  <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.name}</p>
                ) : (
                  <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0">A friendly name for this SSH connection</p>
                )}
              </div>

              {/* SSH Host */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">
                  <Terminal size={14} className="text-[#888]" />
                  SSH Host
                </div>
                <input aria-label="Input" type="text"
                  className={cn(
                    "w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]",
                    errors.host ? "border-[var(--status-error)]" : "border-[#444]"
                  )}
                  value={formData.host}
                  onChange={(e) => handleInputChange('host', e.target.value)}
                  placeholder="user@hostname"
                />
                {errors.host ? (
                  <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.host}</p>
                ) : (
                  <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0">user@myserver.com or a host from ~/.ssh/config</p>
                )}
              </div>

              {/* Port & Username */}
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-5">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">SSH Port</div>
                  <input aria-label="Input" type="number"
                    className="w-full p-[10px_12px] rounded-lg border border-solid border-[#444] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none focus:border-[var(--accent-primary)]"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
                    placeholder="22"
                  />
                  <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0">Leave empty for 22</p>
                </div>
                <div className="mb-5">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Username</div>
                  <input aria-label="Input" type="text"
                    className={cn(
                      "w-full p-[10px_12px] rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]",
                      errors.username ? "border-[var(--status-error)]" : "border-[#444]"
                    )}
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="root"
                  />
                  {errors.username && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.username}</p>}
                </div>
              </div>

              {/* Auth Type */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">
                  <Key size={14} className="text-[#888]" />
                  Authentication
                </div>
                <div className="flex gap-2 p-1 bg-[var(--surface-panel)] rounded-lg border border-solid border-[#333]">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 p-2 rounded-md border-none text-[13px] font-medium cursor-pointer transition-all",
                      formData.authType === 'key' ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" : "bg-transparent text-[var(--ui-text-secondary)]"
                    )}
                    onClick={() => handleInputChange('authType', 'key')}
                  >
                    <FileKey size={16} />
                    SSH Key
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 p-2 rounded-md border-none text-[13px] font-medium cursor-pointer transition-all",
                      formData.authType === 'password' ? "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]" : "bg-transparent text-[var(--ui-text-secondary)]"
                    )}
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
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Identity File (Private Key)</div>
                    <div className="flex gap-2">
                      <input aria-label="Input" type="text"
                        className="flex-1 p-[10px_12px] rounded-lg border border-solid border-[#444] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none focus:border-[var(--accent-primary)]"
                        value={formData.privateKeyPath}
                        onChange={(e) => handleInputChange('privateKeyPath', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                      />
                      <input aria-label="File upload" ref={fileInputRef} type="file" accept=".pem,.key,.txt" onChange={handleFileUpload} className="hidden" />
                      <button
                        type="button"
                        className="p-2.5 rounded-lg border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadSimple size={16} />
                      </button>
                    </div>
                    <p className="text-[12px] text-[var(--ui-text-tertiary)] mt-1 m-0">Leave empty to use default SSH key</p>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Or paste private key</div>
                    <textarea aria-label="Text Area" className="w-full p-[10px_12px] rounded-lg border border-solid border-[#444] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[12px] font-mono outline-none resize-none min-h-[100px] focus:border-[var(--accent-primary)]"
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
                <div className="mb-5">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5 text-[var(--ui-text-primary)]">Password</div>
                  <div className="relative">
                    <input aria-label="Input" type={showPassword ? 'text' : 'password'}
                      className={cn(
                        "w-full p-[10px_12px] pr-10 rounded-lg border border-solid bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] outline-none transition-colors focus:border-[var(--accent-primary)]",
                        errors.password ? "border-[var(--status-error)]" : "border-[#444]"
                      )}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter SSH password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-[var(--ui-text-secondary)] cursor-pointer p-1 hover:text-[var(--ui-text-primary)]"
                    >
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[12px] text-[var(--status-error)] mt-1 m-0">{errors.password}</p>}
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div
                  className={cn(
                    "p-4 rounded-lg border border-solid mb-5",
                    testResult.success ? "bg-green-500/10 border-green-500/30" : "bg-[var(--status-error-bg)] border-red-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle size={20} className="text-[var(--status-success)] shrink-0 mt-0.5" />
                    ) : (
                      <Warning size={20} className="text-[var(--status-error)] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={cn("text-[13px] font-semibold m-0", testResult.success ? "text-[var(--status-success)]" : "text-[var(--status-error)]")}>
                        {testResult.success ? 'Connection successful' : 'Connection failed'}
                      </p>
                      <p className="text-[12px] text-[var(--ui-text-secondary)] mt-1 m-0">{testResult.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                {onTest && (
                  <button
                    type="button"
                    className="p-[10px_16px] rounded-lg border-none bg-[var(--surface-panel)] text-[var(--ui-text-primary)] text-[13px] font-medium cursor-pointer flex items-center gap-1.5 transition-all hover:bg-white/5 disabled:opacity-50"
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? <CircleNotch size={16} className="animate-spin" /> : 'Test Connection'}
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 p-[10px_16px] rounded-lg border-none bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Add SSH Connection
                </button>
              </div>
            </form>
          ) : (
            /* Help Tab */
            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="size-8 rounded-lg bg-[var(--status-info)]/20 flex items-center justify-center text-[12px] font-bold text-[var(--status-info)] shrink-0">1</div>
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">Get your VPS ready</h4>
                  <p className="text-[12px] text-[var(--ui-text-secondary)] m-0 leading-relaxed">Ensure you have a VPS with SSH access enabled (Hetzner, DigitalOcean, etc.).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="size-8 rounded-lg bg-[var(--status-info)]/20 flex items-center justify-center text-[12px] font-bold text-[var(--status-info)] shrink-0">2</div>
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">Generate SSH keys</h4>
                  <p className="text-[12px] text-[var(--ui-text-secondary)] m-0 leading-relaxed">If needed, run this on your local machine:</p>
                  <div className="mt-2 p-[10px_12px] bg-[var(--surface-panel)] rounded-lg border border-solid border-[#333] font-mono text-[12px] text-[var(--accent-primary)] break-all">
                    ssh-keygen -t ed25519 -C "allternit-ssh"
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="size-8 rounded-lg bg-[var(--status-info)]/20 flex items-center justify-center text-[12px] font-bold text-[var(--status-info)] shrink-0">3</div>
                <div>
                  <h4 className="text-[13px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">Copy your public key</h4>
                  <p className="text-[12px] text-[var(--ui-text-secondary)] m-0 leading-relaxed">Authorize your local key on the remote server:</p>
                  <div className="mt-2 p-[10px_12px] bg-[var(--surface-panel)] rounded-lg border border-solid border-[#333] font-mono text-[12px] text-[var(--accent-primary)] break-all">
                    ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[var(--status-warning)]/10 border border-solid border-[var(--status-warning)]/30 rounded-xl flex gap-2.5">
                <Warning size={20} className="text-[var(--status-warning)] shrink-0" />
                <div>
                  <p className="text-[13px] font-bold text-[var(--status-warning)] m-0">Security tip</p>
                  <p className="text-[12px] text-[var(--ui-text-secondary)] mt-1 m-0 leading-relaxed">Allternit stores keys locally encrypted and only uses them for authorized SSH sessions.</p>
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
