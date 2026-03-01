/**
 * ProviderModelSelector
 * 
 * New model selector with:
 * - Auth status awareness (lock/unlock)
 * - Runtime model discovery
 * - Cache management
 * - Freeform model ID input
 * - Validation
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Check, 
  Lock, 
  RefreshCw, 
  Terminal, 
  AlertCircle,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useProviderAuth } from '@/hooks/useProviderAuth';
import { useToast } from '@/hooks/use-toast';

export interface ProviderModelSelectorProps {
  providerId: string;
  providerName: string;
  profileId: string;
  authProfileId?: string;
  value?: string;
  onChange: (modelId: string) => void;
  className?: string;
  onLaunchTerminal?: (sessionId: string) => void;
}

export function ProviderModelSelector({
  providerId,
  providerName,
  profileId,
  authProfileId,
  value,
  onChange,
  className,
  onLaunchTerminal
}: ProviderModelSelectorProps) {
  const { toast } = useToast();
  const {
    getProviderState,
    refreshModels,
    refreshAuthStatus,
    validateModelId,
    createAuthSession,
    isProviderLocked,
    isCacheStale
  } = useProviderAuth();

  const state = getProviderState(providerId);
  const isLocked = isProviderLocked(providerId);
  const isStale = isCacheStale(providerId);

  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [freeformModelId, setFreeformModelId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load models on mount if authenticated
  useEffect(() => {
    if (!isLocked && state.models.length === 0 && !state.isLoadingModels) {
      refreshModels(providerId, profileId);
    }
  }, [providerId, profileId, isLocked]);

  const handleRefresh = useCallback(async () => {
    await refreshModels(providerId, profileId);
    toast({
      title: "Models refreshed",
      description: `Updated ${providerName} model list from runtime`
    });
  }, [providerId, profileId, providerName, refreshModels, toast]);

  const handleAuthenticate = useCallback(async () => {
    if (!authProfileId) {
      toast({
        title: "Auth not available",
        description: "No auth profile configured for this provider",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingSession(true);
    try {
      const sessionId = await createAuthSession(authProfileId);
      setIsAuthDialogOpen(false);
      
      if (onLaunchTerminal) {
        onLaunchTerminal(sessionId);
        
        // Poll for auth completion
        const pollInterval = setInterval(async () => {
          await refreshAuthStatus();
          const newState = getProviderState(providerId);
          if (newState.auth?.status === 'ok') {
            clearInterval(pollInterval);
            toast({
              title: "Authentication successful",
              description: `${providerName} is now unlocked`
            });
          }
        }, 3000);
        
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
      }
    } catch (err) {
      toast({
        title: "Auth failed",
        description: err instanceof Error ? err.message : "Failed to start auth session",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSession(false);
    }
  }, [authProfileId, createAuthSession, onLaunchTerminal, providerId, providerName, refreshAuthStatus, getProviderState, toast]);

  const handleValidateFreeform = useCallback(async () => {
    if (!freeformModelId.trim()) return;
    
    setIsValidating(true);
    setValidationError(null);
    setSuggestions([]);
    
    try {
      const result = await validateModelId(providerId, profileId, freeformModelId);
      
      if (result.valid) {
        onChange(freeformModelId);
        toast({
          title: "Model validated",
          description: `"${freeformModelId}" is valid`
        });
      } else {
        setValidationError(result.message || "Invalid model ID");
        if (result.suggested) {
          setSuggestions(result.suggested);
        }
      }
    } catch (err) {
      setValidationError("Failed to validate model ID");
    } finally {
      setIsValidating(false);
    }
  }, [freeformModelId, providerId, profileId, validateModelId, onChange, toast]);

  // Locked state
  if (isLocked) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span className="text-sm">{providerName} locked</span>
        </div>
        
        <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Authenticate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Authenticate {providerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                This provider requires authentication. A terminal session will open for you to complete the login.
              </p>
              <Button 
                onClick={handleAuthenticate} 
                disabled={isCreatingSession}
                className="w-full"
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening terminal...
                  </>
                ) : (
                  <>
                    <Terminal className="mr-2 h-4 w-4" />
                    Open Auth Terminal
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Loading state
  if (state.isLoadingModels && state.models.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading models...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error && state.models.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{state.error}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Model selector with refresh */}
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select a model..." />
          </SelectTrigger>
          <SelectContent>
            {state.models.length === 0 ? (
              <SelectItem value="__none__" disabled>
                No models available
              </SelectItem>
            ) : (
              state.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.label}</span>
                    {model.meta?.vision && (
                      <span className="text-xs text-muted-foreground">(vision)</span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={state.isLoadingModels}
          title="Refresh models"
        >
          <RefreshCw className={cn("h-4 w-4", state.isLoadingModels && "animate-spin")} />
        </Button>
      </div>

      {/* Cache freshness indicator */}
      {state.lastFetched && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3 w-3" />
          <span>
            Updated {formatTimeAgo(state.lastFetched)}
            {isStale && (
              <span className="text-amber-500 ml-1">(stale)</span>
            )}
          </span>
        </div>
      )}

      {/* Freeform input for custom model IDs */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground mb-2">
          Or enter a custom model ID:
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="e.g., anthropic:claude-3-7-sonnet"
            value={freeformModelId}
            onChange={(e) => setFreeformModelId(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidateFreeform}
            disabled={!freeformModelId.trim() || isValidating}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Validate"
            )}
          </Button>
        </div>
        
        {validationError && (
          <div className="mt-2 text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {validationError}
          </div>
        )}
        
        {suggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Did you mean:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFreeformModelId(suggestion);
                    onChange(suggestion);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
