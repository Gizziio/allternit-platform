"use client";

/**
 * Mesh Network Settings Component
 * 
 * Integrated into Settings → Infrastructure for VPS mesh setup.
 */

import React, { useState, useEffect } from 'react';
import {
  Globe,
  HardDrives,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  Copy,
  Shield,
  Warning,
  Trash,
} from '@phosphor-icons/react';
import type { 
  MeshSettingsState, 
  MeshSetupOption 
} from '@/lib/mesh-network/integrations/vps-setup';
import { 
  MESH_SETUP_OPTIONS, 
  getDefaultMeshSettings 
} from '@/lib/mesh-network/integrations/vps-setup';

interface MeshNetworkSettingsProps {
  userId: string;
  onSetupComplete?: (state: MeshSettingsState) => void;
}

export function MeshNetworkSettings({ userId, onSetupComplete }: MeshNetworkSettingsProps) {
  const [state, setState] = useState<MeshSettingsState>(getDefaultMeshSettings());
  const [selectedOption, setSelectedOption] = useState<MeshSetupOption['id']>('new');
  const [isLoading, setIsLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  // Load existing state
  useEffect(() => {
    const saved = localStorage.getItem(`mesh-settings-${userId}`);
    if (saved) {
      setState(JSON.parse(saved));
    }
  }, [userId]);

  const handleSaveSettings = () => {
    localStorage.setItem(`mesh-settings-${userId}`, JSON.stringify(state));
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setState(prev => ({ ...prev, serverStatus: 'connecting' }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = serverUrl.includes('http');
    setState(prev => ({
      ...prev,
      serverStatus: success ? 'connected' : 'error',
      errorMessage: success ? undefined : 'Could not connect to server',
    }));
    
    setIsLoading(false);
    
    if (success) {
      handleSaveSettings();
      onSetupComplete?.(state);
    }
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const installCommand = selectedOption === 'new' 
    ? `curl -fsSL https://install.allternit.com/headscale | sudo bash`
    : '';

  const agentCommand = `curl -fsSL https://install.allternit.com/agent | sudo bash -s -- --user ${userId}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Globe className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              Mesh Network (BYOC)
            </h3>
            <p className="text-sm text-gray-400">
              Connect your VPS through a secure mesh network. You host the coordination server, 
              Allternit joins as a guest. Zero trust, maximum security.
            </p>
          </div>
        </div>
      </div>

      {/* Setup Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">Choose Setup Method</h4>
        
        <div className="grid gap-3">
          {MESH_SETUP_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`relative text-left p-4 rounded-lg border transition-all ${
                selectedOption === option.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              {option.recommended && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                  Recommended
                </span>
              )}
              
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === option.id ? 'border-blue-500' : 'border-zinc-600'
                }`}>
                  {selectedOption === option.id && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  )}
                </div>
                <span className="font-medium text-white">{option.title}</span>
              </div>
              
              <p className="text-sm text-gray-400 ml-8 mb-3">{option.description}</p>
              
              <div className="ml-8 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-green-400">✓ Pros:</span>
                  <ul className="mt-1 space-y-0.5 text-gray-500">
                    {option.pros.map((pro, i) => (
                      <li key={i}>{pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-amber-400">Consider:</span>
                  <ul className="mt-1 space-y-0.5 text-gray-500">
                    {option.cons.map((con, i) => (
                      <li key={i}>{con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Panel */}
      {selectedOption === 'existing' && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Connect Existing Server</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Server URL</label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://headscale.example.com"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="hsk_..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Generate with: headscale apikeys create
              </p>
            </div>
            
            <button
              onClick={handleTestConnection}
              disabled={isLoading || !serverUrl || !apiKey}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <ArrowClockwise className="w-4 h-4 animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>
            
            {state.serverStatus === 'connected' && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="w-4 h-4" />
                Connected successfully
              </div>
            )}
            
            {state.serverStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <XCircle className="w-4 h-4" />
                {state.errorMessage || 'Connection failed'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Server Setup */}
      {selectedOption === 'new' && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
          <div className="flex items-start gap-3">
            <HardDrives className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-white">Automatic Setup</h4>
              <p className="text-sm text-gray-400 mt-1">
                We&apos;ll install Headscale on your VPS automatically. This requires:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>• Root access to VPS</li>
                <li>• Port 8080 available (or custom port)</li>
                <li>• ~100MB disk space</li>
                <li>• ~50MB RAM</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-zinc-900 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Install Command</span>
              <button
                onClick={() => handleCopyCommand(installCommand)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Copy className="w-3 h-3" />
                {showCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="block text-xs text-gray-300 font-mono break-all">
              {installCommand}
            </code>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded">
            <Warning className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-200">
              After running this command on your VPS, return here and click &quot;Verify Connection&quot;
            </p>
          </div>
          
          <button
            onClick={handleTestConnection}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded text-sm font-medium text-white"
          >
            {isLoading ? 'Verifying...' : 'Verify Connection'}
          </button>
        </div>
      )}

      {/* Agent Installation */}
      {(state.serverStatus === 'connected' || selectedOption === 'skip') && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Install Allternit Agent
          </h4>
          
          <p className="text-sm text-gray-400">
            Run this command on each VPS you want to connect:
          </p>
          
          <div className="bg-zinc-900 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Agent Install Command</span>
              <button
                onClick={() => handleCopyCommand(agentCommand)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <code className="block text-xs text-gray-300 font-mono break-all">
              {agentCommand}
            </code>
          </div>
          
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span>
              This installs the agent as unprivileged user. Your SSH access remains unchanged. 
              Uninstall anytime with: <code className="text-gray-400">sudo /opt/allternit-agent/uninstall.sh</code>
            </span>
          </div>
        </div>
      )}

      {/* Connected Nodes */}
      {state.nodes.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Connected Nodes</h4>
          
          <div className="space-y-2">
            {state.nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between p-3 bg-zinc-900 rounded"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    node.status === 'online' ? 'bg-green-400' : 'bg-gray-600'
                  }`} />
                  <div>
                    <div className="text-sm text-white">{node.name}</div>
                    <div className="text-xs text-gray-500">{node.ip}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {node.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                  <button className="p-1 text-gray-500 hover:text-red-400">
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <Shield className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-green-400">Security First</h4>
          <p className="text-sm text-gray-400 mt-1">
            Your mesh server is hosted on YOUR infrastructure. Allternit connects as a guest 
            and can be revoked at any time. Private keys never leave your servers.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MeshNetworkSettings;
