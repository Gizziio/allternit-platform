/**
 * Provider Gallery Component
 * 
 * A visually rich gallery for connecting AI providers (Anthropic, OpenAI, etc.)
 * Inspired by OpenCode's "Connect Providers" UI.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useModelDiscovery, api } from '@/integration/api-client';
import { PROVIDER_REGISTRY, getProviderMeta } from '@/lib/providers/provider-registry';
import {
  Check,
  ExternalLink,
  Shield,
  Key,
  AlertCircle,
  ChevronRight,
  Info,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================================
// Types
// ============================================================================

interface ProviderCardProps {
  providerId: string;
  name: string;
  icon: string;
  color: string;
  authenticated: boolean;
  status: string;
  onClick: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const THEME = {
  cardBg: 'rgba(255, 255, 255, 0.03)',
  cardHover: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
};

// ============================================================================
// Sub-components
// ============================================================================

const ProviderCard: React.FC<ProviderCardProps> = ({ 
  providerId, 
  name, 
  icon, 
  color, 
  authenticated, 
  status,
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all group relative overflow-hidden",
        authenticated ? "border-white/10 bg-white/5" : "border-white/5 bg-transparent hover:bg-white/5"
      )}
      style={{
        borderColor: authenticated ? `${color}40` : undefined,
      }}
    >
      {/* Visual background glow if authenticated */}
      {authenticated && (
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}
        />
      )}

      {/* Icon Container */}
      <div 
        className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <img 
          src={`/assets/runtime-logos/${icon}`} 
          alt={name}
          className="w-10 h-10 object-contain"
          onError={(e) => {
            // Fallback for missing icons
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="text-2xl font-bold" style="color: ${color}">${name[0]}</div>`;
          }}
        />
        
        {authenticated && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-[#1a1a1a]">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-center relative z-10">
        <h3 className="font-semibold text-white text-sm">{name}</h3>
        <p className="text-xs text-white/40 mt-0.5">
          {authenticated ? "Connected" : "Not connected"}
        </p>
      </div>

      {/* Action hint */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-white/40" />
      </div>
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ProviderGallery: React.FC = () => {
  const { providers, fetchProviders, providersLoading } = useModelDiscovery();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleConnect = async () => {
    if (!selectedProvider || !apiKey) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Call the API to persist provider credentials
      await api.post(`/api/v1/providers/${selectedProvider}/auth`, {
        api_key: apiKey,
      });

      // Close modal and refresh status
      setSelectedProvider(null);
      setApiKey('');
      await fetchProviders();
    } catch (err: any) {
      setError(err.message || "Failed to connect provider");
    } finally {
      setIsConnecting(false);
    }
  };

  const currentMeta = selectedProvider ? getProviderMeta(selectedProvider) : null;

  return (
    <div className="w-full max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Connect Providers</h2>
        <p className="text-white/40 text-sm">
          Select an AI provider to enable their models on the A2R Platform.
        </p>
      </div>

      {providersLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          <p className="text-white/40 text-sm">Loading providers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {providers.map((p) => {
            const meta = getProviderMeta(p.provider_id);
            return (
              <ProviderCard
                key={p.provider_id}
                providerId={p.provider_id}
                name={meta.name}
                icon={meta.icon}
                color={meta.color}
                authenticated={p.authenticated}
                status={p.status}
                onClick={() => setSelectedProvider(p.provider_id)}
              />
            );
          })}
          
          {/* Add Others Placeholder */}
          <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-white/20">
              <Plus className="w-6 h-6 text-white/40" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-white/40 text-sm italic">Coming Soon</h3>
            </div>
          </button>
        </div>
      )}

      {/* Connection Dialog */}
      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-white/10 text-white p-0 overflow-hidden rounded-2xl">
          {currentMeta && (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${currentMeta.color}20`, border: `1px solid ${currentMeta.color}40` }}
                  >
                    <img src={`/assets/runtime-logos/${currentMeta.icon}`} alt="" className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">Connect {currentMeta.name}</DialogTitle>
                    <DialogDescription className="text-white/40">
                      Configure your {currentMeta.name} API credentials
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <Key className="w-3.5 h-3.5" />
                    API Key
                  </label>
                  <input
                    type="password"
                    placeholder={`Enter your ${currentMeta.name} API key...`}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
                  />
                  <p className="text-[11px] text-white/30 flex items-center gap-1.5 mt-1.5 px-1">
                    <Shield className="w-3 h-3" />
                    Your key is stored locally and never sent to our servers.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-400/90 leading-normal">{error}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 pt-0 flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedProvider(null)}
                  className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border-none h-12 text-white/70"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConnect}
                  disabled={!apiKey || isConnecting}
                  className="flex-1 rounded-xl h-12 font-semibold transition-all"
                  style={{ 
                    background: isConnecting ? `${currentMeta.color}40` : currentMeta.color,
                    color: '#fff' 
                  }}
                >
                  {isConnecting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </div>
                  ) : "Connect Account"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================================
// Helper Components for the Gallery
// ============================================================================

function Plus({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

export default ProviderGallery;
