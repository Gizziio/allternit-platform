"use client";

import { useState, useEffect, useCallback } from "react";
import { useModelDiscovery } from "@/integration/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export interface ModelSelection {
  providerId: string;
  profileId: string;
  modelId: string;
  modelName?: string;
}

interface ModelPickerProps {
  onSelect: (selection: ModelSelection) => void;
  onCancel?: () => void;
  defaultProfileId?: string;
  trigger?: React.ReactNode;
  /// Controlled open state - if provided, component becomes controlled
  open?: boolean;
  /// Callback when open state changes
  onOpenChange?: (open: boolean) => void;
}

// Profile to provider mapping
const PROFILE_TO_PROVIDER: Record<string, string> = {
  "opencode-acp": "opencode",
  "opencode-auth": "opencode",
  "gemini-acp": "gemini",
  "gemini-cli": "gemini",
  "gemini-auth": "gemini",
  "claude-acp": "claude",
  "claude-code": "claude",
  "claude-auth": "claude",
  "kimi-acp": "kimi",
  "kimi-cli": "kimi",
  "kimi-auth": "kimi",
  "codex-acp": "codex",
  "codex-auth": "codex",
  "qwen-acp": "qwen",
};

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  opencode: "OpenCode",
  gemini: "Google Gemini",
  claude: "Claude",
  kimi: "Kimi",
  codex: "Codex",
  qwen: "Qwen",
};

export function ModelPicker({ onSelect, onCancel, defaultProfileId, trigger, open: controlledOpen, onOpenChange }: ModelPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };
  const [step, setStep] = useState<"profile" | "model">("profile");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [freeformInput, setFreeformInput] = useState<string>("");
  const [validationAttempted, setValidationAttempted] = useState(false);

  const {
    authenticatedProviders,
    providersLoading,
    providersError,
    fetchProviders,
    discoveryResult,
    discoveryLoading,
    discoverModels,
    validationResult,
    validationLoading,
    validateModel,
  } = useModelDiscovery();

  // Fetch providers when dialog opens
  useEffect(() => {
    if (open) {
      fetchProviders();
      if (defaultProfileId) {
        setSelectedProfileId(defaultProfileId);
        setStep("model");
        const providerId = PROFILE_TO_PROVIDER[defaultProfileId];
        if (providerId) {
          discoverModels(providerId);
        }
      }
    }
  }, [open, defaultProfileId, fetchProviders, discoverModels]);

  // Auto-validate when user types in freeform
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (freeformInput && step === "model" && !discoveryResult?.supported) {
        const providerId = PROFILE_TO_PROVIDER[selectedProfileId];
        if (providerId) {
          await validateModel(providerId, freeformInput);
        }
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [freeformInput, step, discoveryResult?.supported, selectedProfileId, validateModel]);

  const handleProfileSelect = useCallback(async (profileId: string) => {
    setSelectedProfileId(profileId);
    setSelectedModelId("");
    setFreeformInput("");
    setValidationAttempted(false);
    
    const providerId = PROFILE_TO_PROVIDER[profileId];
    if (providerId) {
      await discoverModels(providerId);
    }
    setStep("model");
  }, [discoverModels]);

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    setFreeformInput("");
    setValidationAttempted(false);
  }, []);

  const handleFreeformChange = useCallback((value: string) => {
    setFreeformInput(value);
    setSelectedModelId(value);
    setValidationAttempted(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedProfileId || !selectedModelId) return;

    const providerId = PROFILE_TO_PROVIDER[selectedProfileId];
    if (!providerId) return;

    const modelName = discoveryResult?.models?.find(m => m.id === selectedModelId)?.name || selectedModelId;

    onSelect({
      providerId,
      profileId: selectedProfileId,
      modelId: selectedModelId,
      modelName,
    });
    setOpen(false);
    setStep("profile");
    setSelectedProfileId("");
    setSelectedModelId("");
    setFreeformInput("");
  }, [onSelect, selectedProfileId, selectedModelId, discoveryResult?.models]);

  const handleBack = useCallback(() => {
    setStep("profile");
    setSelectedModelId("");
    setFreeformInput("");
    setValidationAttempted(false);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    onCancel?.();
    setStep("profile");
    setSelectedProfileId("");
    setSelectedModelId("");
    setFreeformInput("");
  }, [onCancel]);

  // Get authenticated profiles (filter to only chat profiles)
  interface AvailableProfile {
    profileId: string;
    providerId: string;
    displayName: string;
  }

  const availableProfiles: AvailableProfile[] = authenticatedProviders.flatMap((provider: { provider_id: string; chat_profile_ids: string[] }) => 
    provider.chat_profile_ids.map((profileId: string) => ({
      profileId,
      providerId: provider.provider_id,
      displayName: PROVIDER_NAMES[provider.provider_id] || provider.provider_id,
    }))
  );

  const isReady = selectedModelId && (validationResult?.valid || discoveryResult?.supported);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Select Model
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {step === "profile" ? "Select Runtime" : "Select Model"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === "profile" 
              ? "Choose an authenticated AI runtime to use"
              : `Select a model for ${PROVIDER_NAMES[PROFILE_TO_PROVIDER[selectedProfileId]] || "this runtime"}`
            }
          </DialogDescription>
        </DialogHeader>

        {providersError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load providers. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {step === "profile" ? (
          <div className="space-y-4 py-4">
            {providersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableProfiles.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-white">No authenticated runtimes found</p>
                <p className="text-sm mt-1 text-gray-400">
                  Please authenticate a provider first
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {availableProfiles.map(({ profileId, providerId, displayName }: AvailableProfile) => (
                  <Button
                    key={profileId}
                    variant={selectedProfileId === profileId ? "default" : "outline"}
                    className={`justify-start h-auto py-3 px-4 border-[#333333] ${
                      selectedProfileId === profileId 
                        ? 'bg-[#d4966a] hover:bg-[#c4865a] text-white' 
                        : 'bg-transparent hover:bg-[#2a2a2a] text-white'
                    }`}
                    onClick={() => handleProfileSelect(profileId)}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-medium">{displayName}</span>
                      <span className="text-xs text-gray-400">
                        {profileId}
                      </span>
                    </div>
                    {selectedProfileId === profileId && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {discoveryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : discoveryResult?.supported && discoveryResult.models ? (
              // Discovery supported - show dropdown
              <div className="space-y-2">
                <Label className="text-gray-300">Select Model</Label>
                <Select value={selectedModelId} onValueChange={handleModelSelect}>
                  <SelectTrigger className="bg-[#2a2a2a] border-[#333333] text-white">
                    <SelectValue placeholder="Choose a model..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e1e1e] border-[#333333]">
                    {discoveryResult.models.map((model) => (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        className="text-white hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
                      >
                        <div className="flex flex-col items-start">
                          <span>{model.name}</span>
                          {model.description && (
                            <span className="text-xs text-gray-400">
                              {model.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModelId && discoveryResult.models.find(m => m.id === selectedModelId)?.capabilities && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {discoveryResult.models
                      .find(m => m.id === selectedModelId)
                      ?.capabilities?.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              // Discovery not supported - show freeform input
              <div className="space-y-2">
                <Label htmlFor="model-input">
                  Model ID
                  {discoveryResult?.freeform_hint && (
                    <span className="text-muted-foreground text-sm font-normal ml-2">
                      ({discoveryResult.freeform_hint})
                    </span>
                  )}
                </Label>
                <Input
                  id="model-input"
                  placeholder="Enter model ID..."
                  value={freeformInput}
                  onChange={(e) => handleFreeformChange(e.target.value)}
                  className={cn(
                    validationResult?.valid && "border-green-500",
                    validationResult?.valid === false && freeformInput && "border-red-500"
                  )}
                />
                {validationLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Validating...
                  </div>
                )}
                {validationResult && !validationLoading && (
                  <div className={cn(
                    "text-sm",
                    validationResult.valid ? "text-green-600" : "text-red-600"
                  )}>
                    {validationResult.valid ? (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        {validationResult.model?.description || "Model ID valid"}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {validationResult.message || "Invalid model ID"}
                      </div>
                    )}
                  </div>
                )}
                {validationResult?.suggested && validationResult.suggested.length > 0 && (
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground">Did you mean:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {validationResult.suggested.slice(0, 5).map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-secondary"
                          onClick={() => handleFreeformChange(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={!isReady}
                className="flex-1"
              >
                Confirm
              </Button>
            </div>
          </div>
        )}

        {step === "profile" && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ModelPicker;
