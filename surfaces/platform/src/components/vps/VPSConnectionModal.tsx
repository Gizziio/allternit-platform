/**
 * VPSConnectionModal - Unified entry point for VPS connections
 * 
 * This modal provides two paths:
 * 1. "Get a New VPS" - Opens the existing VPS marketplace/wizard for provisioning
 * 2. "Connect Existing VPS" - Opens the simplified SSH form (Claude Code style)
 */

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HardDrives,
  Plus,
  Link,
  Sparkle,
  Terminal,
  Cloud,
  CaretRight,
} from '@phosphor-icons/react';
import { VPSMarketplace } from './VPSMarketplace';
import { AddSSHConnectionForm, type SSHConnectionFormData, type SSHConnectionTestResult } from '@/components/ssh';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/a2r.tokens';

export interface VPSConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectExisting?: (data: SSHConnectionFormData) => Promise<void>;
  onTestConnection?: (data: SSHConnectionFormData) => Promise<SSHConnectionTestResult>;
  onSelectProvider?: (providerId: string) => void;
}

type ModalView = 'menu' | 'marketplace' | 'ssh-form';

export function VPSConnectionModal({
  isOpen,
  onClose,
  onConnectExisting,
  onTestConnection,
  onSelectProvider,
}: VPSConnectionModalProps) {
  const [currentView, setCurrentView] = useState<ModalView>('menu');

  useEffect(() => {
    if (isOpen) {
      setCurrentView('menu');
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (currentView !== 'menu') {
      setCurrentView('menu');
    } else {
      onClose();
    }
  }, [currentView, onClose]);

  const handleSSHSubmit = useCallback(async (data: SSHConnectionFormData) => {
    if (onConnectExisting) {
      await onConnectExisting(data);
    }
    onClose();
  }, [onConnectExisting, onClose]);

  const handleProviderSelect = useCallback((providerId: string) => {
    if (onSelectProvider) {
      onSelectProvider(providerId);
    }
    onClose();
  }, [onSelectProvider, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Main Modal */}
      {currentView === 'menu' && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-[672px] overflow-hidden rounded-2xl"
            style={{
              background: 'rgba(20,20,20,0.95)',
              border: '1px solid #333',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid #333' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${STATUS.info}33, rgba(147,51,234,0.2))`,
                    border: `1px solid ${STATUS.info}4c`,
                  }}
                >
                  <HardDrives size={20} style={{ color: STATUS.info }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Add Compute Resource</h2>
                  <p style={{ fontSize: '12px', color: TEXT.secondary }}>
                    Choose how you want to add infrastructure
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'transparent', color: TEXT.secondary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#252525';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#888';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Option 1: Get New VPS */}
                <button
                  onClick={() => setCurrentView('marketplace')}
                  className="group relative p-6 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(37,37,37,0.2)',
                    border: '1px solid #333',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${SAND[500]}80`;
                    e.currentTarget.style.background = 'rgba(37,37,37,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = 'rgba(37,37,37,0.2)';
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${STATUS.success}33, rgba(16,185,129,0.2))`,
                        border: `1px solid ${STATUS.success}4c`,
                      }}
                    >
                      <Plus size={24} style={{ color: STATUS.success }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-[15px]">Get a New VPS</h3>
                        <Sparkle size={16} style={{ color: STATUS.warning }} />
                      </div>
                      <p className="text-[13px] mb-3 leading-relaxed" style={{ color: TEXT.secondary }}>
                        Provision a new VPS from Hetzner, DigitalOcean, AWS, or other providers with our guided setup.
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
                        <Cloud className="w-3.5 h-3.5" />
                        <span>5+ providers supported</span>
                      </div>
                    </div>
                    <CaretRight 
                      className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 transition-opacity" 
                      style={{ color: TEXT.secondary, opacity: 0 }}
                    />
                  </div>
                  <style jsx>{`
                    button:hover .chevron {
                      opacity: 1 !important;
                    }
                  `}</style>
                </button>

                {/* Option 2: Connect Existing */}
                <button
                  onClick={() => setCurrentView('ssh-form')}
                  className="group relative p-6 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(37,37,37,0.2)',
                    border: '1px solid #333',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${SAND[500]}80`;
                    e.currentTarget.style.background = 'rgba(37,37,37,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = 'rgba(37,37,37,0.2)';
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${STATUS.info}33, rgba(147,51,234,0.2))`,
                        border: `1px solid ${STATUS.info}4c`,
                      }}
                    >
                      <Link size={24} style={{ color: STATUS.info }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-[15px] mb-1">Connect Existing VPS</h3>
                      <p className="text-[13px] mb-3 leading-relaxed" style={{ color: TEXT.secondary }}>
                        Already have a VPS? Connect it directly via SSH. Just like Claude Code - simple and fast.
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
                        <Terminal className="w-3.5 h-3.5" />
                        <span>SSH key or password auth</span>
                      </div>
                    </div>
                    <CaretRight 
                      className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" 
                      style={{ color: TEXT.secondary }}
                    />
                  </div>
                </button>
              </div>

              {/* Info Box */}
              <div 
                className="p-4 rounded-lg flex gap-3"
                style={{
                  background: 'rgba(37,37,37,0.3)',
                  border: '1px solid #333',
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${STATUS.info}1a` }}
                >
                  <HardDrives size={16} style={{ color: STATUS.info }} />
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-white mb-1">Not sure which to choose?</h4>
                  <ul className="text-xs space-y-1" style={{ color: TEXT.secondary, listStyle: 'none', padding: 0 }}>
                    <li>
                      <span style={{ color: TEXT.tertiary, marginRight: '6px' }}>•</span>
                      <strong style={{ color: TEXT.secondary }}>Get a New VPS</strong> if you don't have a server yet or want to provision fresh infrastructure
                    </li>
                    <li>
                      <span style={{ color: TEXT.tertiary, marginRight: '6px' }}>•</span>
                      <strong style={{ color: TEXT.secondary }}>Connect Existing</strong> if you already have a VPS running and just want to add it to A2R
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      <VPSMarketplace
        isOpen={isOpen && currentView === 'marketplace'}
        onClose={() => setCurrentView('menu')}
        onSelectProvider={handleProviderSelect}
      />

      <AddSSHConnectionForm
        isOpen={isOpen && currentView === 'ssh-form'}
        onClose={() => setCurrentView('menu')}
        onSubmit={handleSSHSubmit}
        onTest={onTestConnection}
      />
    </>,
    document.body
  );
}

export default VPSConnectionModal;
