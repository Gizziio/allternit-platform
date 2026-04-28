/**
 * BrainModelSelector
 * 
 * Comprehensive model selector that:
 * - Groups providers by auth status
 * - Shows runtime-discovered models
 * - Handles auth wizard flow
 * - Supports freeform model IDs
 */

import { useState, useEffect } from 'react';
import {
  Check,
  Lock,
  Terminal,
  Brain,
} from '@phosphor-icons/react';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useProviderAuth } from '../../hooks/useProviderAuth';
import { useToast } from '../../hooks/use-toast';
import { ProviderModelSelector } from './ProviderModelSelector';

export interface BrainModelSelectorProps {
  value?: string;
  onChange: (value: string, metadata: { 
    providerId: string;
    profileId: string;
    runtimeModelId?: string;
  }) => void;
  className?: string;
  onLaunchTerminal?: (sessionId: string) => void;
}

interface ProviderGroup {
  providerId: string;
  providerName: string;
  profileId: string;
  authProfileId?: string;
  status: 'available' | 'locked' | 'terminal-only';
}

const PROVIDER_LABELS: Record<string, string> = {
  'claude-cli': 'Claude CLI',
  'codex-cli': 'Codex CLI',
  'gemini-cli': 'Gemini CLI',
  'qwen-cli': 'Qwen CLI',
  'kimi-cli': 'Kimi CLI',
  'opencode': 'OpenCode',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'google': 'Google',
  'ollama': 'Ollama',
  'sidecar': 'Sidecar',
};

function getProviderLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

export function BrainModelSelector({
  value,
  onChange,
  className,
  onLaunchTerminal
}: BrainModelSelectorProps) {
  const { addToast } = useToast();
  const {
    providers,
    getProviderState,
    refreshAuthStatus,
    isProviderLocked
  } = useProviderAuth();

  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<ProviderGroup | null>(null);

  // Refresh auth status on mount
  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  // Get current auth states
  const providerGroups: ProviderGroup[] = Array.from(providers.values())
    .filter((provider) => provider.chat_profile_ids.length > 0)
    .map((provider) => ({
      providerId: provider.provider_id,
      providerName: getProviderLabel(provider.provider_id),
      profileId: provider.chat_profile_ids[0] ?? provider.provider_id,
      authProfileId: provider.auth_profile_id ?? undefined,
      status: 'available' as const,
    }))
    .sort((a, b) => a.providerName.localeCompare(b.providerName));

  const providerStates = providerGroups.map((group) => ({
    ...group,
    isLocked: group.status === 'locked' || (group.status === 'available' && isProviderLocked(group.providerId)),
    state: getProviderState(group.providerId),
  }));

  const availableProviders = providerStates.filter(p => p.status === 'available');
  const terminalProviders = providerStates.filter(p => p.status === 'terminal-only');

  const handleProviderSelect = (providerId: string) => {
    const provider = providerGroups.find((p) => p.providerId === providerId);
    if (!provider) return;

    if (provider.status === 'terminal-only') {
      // Terminal-only brains can't be used in chat
      addToast({
        title: 'Terminal Only',
        description: `${provider.providerName} can only be used in Terminal view`,
        type: 'error'
      });
      return;
    }

    const isLocked = isProviderLocked(providerId);
    if (isLocked) {
      setPendingProvider(provider);
      setIsAuthDialogOpen(true);
      return;
    }

    setSelectedProvider(providerId);
  };

  const handleModelSelect = (modelId: string) => {
    const provider = providerGroups.find((p) => p.providerId === selectedProvider);
    if (!provider) return;

    onChange(modelId, {
      providerId: provider.providerId,
      profileId: provider.profileId,
      runtimeModelId: modelId
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">AI Provider</label>
        <Select 
          value={selectedProvider} 
          onValueChange={handleProviderSelect}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a provider..." />
          </SelectTrigger>
          <SelectContent>
            {/* Available Providers */}
            {availableProviders.length > 0 && (
              <>
                <SelectItem value="__header__" className="font-semibold text-xs pointer-events-none opacity-50">
                  Chat Providers
                </SelectItem>
                {availableProviders.map(provider => (
                  <SelectItem 
                    key={provider.providerId} 
                    value={provider.providerId}
                    className={provider.isLocked ? "pointer-events-none opacity-50" : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {provider.isLocked ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Check className="h-3 w-3 text-green-500" />
                      )}
                      <span>{provider.providerName}</span>
                      {provider.isLocked && (
                        <span className="text-xs text-muted-foreground">(locked)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </>
            )}

            {/* Terminal-Only Providers */}
            {terminalProviders.length > 0 && (
              <>
                <SelectItem value="__terminal__" className="font-semibold text-xs border-t mt-2 pt-2 pointer-events-none opacity-50">
                  Terminal Only
                </SelectItem>
                {terminalProviders.map(provider => (
                  <SelectItem 
                    key={provider.providerId} 
                    value={provider.providerId}
                    className="pointer-events-none opacity-50"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Terminal size={12} />
                      <span>{provider.providerName}</span>
                      <span className="text-xs">(use Terminal view)</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection (when provider selected and unlocked) */}
      {selectedProvider && !isProviderLocked(selectedProvider) && (
        <div className="space-y-2 pl-4 border-l-2 border-muted">
          <label className="text-sm font-medium">Model</label>
          <ProviderModelSelector
            providerId={selectedProvider}
            providerName={providerGroups.find((p) => p.providerId === selectedProvider)?.providerName || ''}
            profileId={providerGroups.find((p) => p.providerId === selectedProvider)?.profileId || ''}
            authProfileId={providerGroups.find((p) => p.providerId === selectedProvider)?.authProfileId}
            value={value}
            onChange={handleModelSelect}
            onLaunchTerminal={onLaunchTerminal}
          />
        </div>
      )}

      {/* Auth Dialog */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authenticate {pendingProvider?.providerName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Authentication Required</p>
                <p className="text-muted-foreground">
                  {pendingProvider?.providerName} requires authentication before use.
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                A terminal session will open for you to complete the login process.
              </p>
              
              {onLaunchTerminal && pendingProvider?.authProfileId && (
                <ProviderModelSelector
                  providerId={pendingProvider.providerId}
                  providerName={pendingProvider.providerName}
                  profileId={pendingProvider.profileId}
                  authProfileId={pendingProvider.authProfileId}
                  value=""
                  onChange={() => {}}
                  onLaunchTerminal={(sessionId) => {
                    setIsAuthDialogOpen(false);
                    onLaunchTerminal(sessionId);
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected Model Display */}
      {value && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{value}</span>
          <Check className="h-4 w-4 text-green-500 ml-auto" />
        </div>
      )}
    </div>
  );
}
