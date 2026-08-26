import React, { useState } from "react";
import { Envelope, Phone, Wallet, Plus, Trash, Cloud, CheckCircle } from "@phosphor-icons/react";
import type { CreateAgentInput, AgentIdentityChannels, AgentEmailChannel, AgentPhoneChannel, AgentWalletChannel, AgentMessagingConfig } from "@/lib/agents/agent.types";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  provisionAgentEmail,
  provisionAgentPhone,
  provisionAgentWallet,
} from "@/lib/agents/agent-identity-provisioning";

interface IdentityChannelsStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  agentId?: string;
  pendingProvisioning?: Record<'email' | 'phone' | 'wallet', boolean>;
  onTogglePendingProvision?: (kind: 'email' | 'phone' | 'wallet') => void;
}

export function IdentityChannelsStep({
  formData,
  setFormData,
  agentId,
  pendingProvisioning = { email: false, phone: false, wallet: false },
  onTogglePendingProvision,
}: IdentityChannelsStepProps) {
  const [provisioning, setProvisioning] = useState<Record<string, boolean>>({});
  const [provisionError, setProvisionError] = useState<Record<string, string>>({});
  const channels = formData.identityChannels || {};
  const messaging = formData.messagingConfig || {};

  const provision = async (
    kind: 'email' | 'phone' | 'wallet',
    action: () => Promise<{ address?: string; number?: string; provider: string; chainId?: string | number }>,
  ) => {
    if (!agentId) return;
    setProvisioning((prev) => ({ ...prev, [kind]: true }));
    setProvisionError((prev) => ({ ...prev, [kind]: '' }));
    try {
      const result = await action();
      if (kind === 'email' && result.address) {
        updateChannels({
          email: {
            address: result.address,
            provider: (result.provider as AgentEmailChannel['provider']) || 'custom',
            sendEnabled: true,
            receiveEnabled: true,
          },
        });
      } else if (kind === 'phone' && result.number) {
        updateChannels({
          phone: {
            number: result.number,
            provider: (result.provider as AgentPhoneChannel['provider']) || 'vapi',
            voiceEnabled: true,
            smsEnabled: true,
          },
        });
      } else if (kind === 'wallet' && result.address) {
        updateChannels({
          wallet: {
            provider: (result.provider as AgentWalletChannel['provider']) || 'etrid',
            address: result.address,
            chainId: result.chainId,
            allowedMethods: ['receive', 'invoice'],
          },
        });
      }
    } catch (err) {
      setProvisionError((prev) => ({
        ...prev,
        [kind]: err instanceof Error ? err.message : 'Provisioning failed',
      }));
    } finally {
      setProvisioning((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const updateChannels = (updates: Partial<AgentIdentityChannels>) => {
    setFormData((prev) => ({
      ...prev,
      identityChannels: { ...channels, ...updates },
    }));
  };

  const updateMessaging = (updates: Partial<AgentMessagingConfig>) => {
    setFormData((prev) => ({
      ...prev,
      messagingConfig: { ...messaging, ...updates },
    }));
  };

  const addEmail = () => {
    const email: AgentEmailChannel = {
      address: '',
      provider: 'commrails',
      sendEnabled: true,
      receiveEnabled: true,
    };
    updateChannels({ email });
  };

  const addPhone = () => {
    const phone: AgentPhoneChannel = {
      number: '',
      provider: 'vapi',
      voiceEnabled: true,
      smsEnabled: true,
    };
    updateChannels({ phone });
  };

  const addWallet = () => {
    const wallet: AgentWalletChannel = {
      provider: 'etrid',
      allowedMethods: ['receive', 'invoice'],
    };
    updateChannels({ wallet });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
            <Envelope size={20} className="text-[var(--accent-primary)]" />
            Identity Channels
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] m-0">
            Give your bot its own email, phone, and wallet so it can act autonomously across surfaces.
          </p>
        </div>

        {/* Email */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <Envelope size={18} className="text-[var(--accent-primary)]" />
              Email
            </div>
            {channels.email ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateChannels({ email: undefined })}
                className="text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
              >
                <Trash size={16} />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {agentId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={provisioning.email}
                    onClick={() => provision('email', () => provisionAgentEmail(agentId))}
                  >
                    {provisioning.email ? '...' : <><Plus size={16} className="mr-1" /> Provision</>}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={pendingProvisioning.email ? 'default' : 'outline'}
                    size="sm"
                    disabled={!onTogglePendingProvision}
                    onClick={() => onTogglePendingProvision?.('email')}
                  >
                    {pendingProvisioning.email ? (
                      <><CheckCircle size={16} className="mr-1" /> Will provision</>
                    ) : (
                      <><Plus size={16} className="mr-1" /> Provision on launch</>
                    )}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {provisionError.email && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{provisionError.email}</p>
          )}

          {channels.email && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                <Input
                  value={channels.email.address}
                  onChange={(e) => updateChannels({ email: { ...channels.email!, address: e.target.value } })}
                  placeholder="bot@yourdomain.com"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.email.provider}
                  onValueChange={(value) => updateChannels({ email: { ...channels.email!, provider: value as AgentEmailChannel['provider'] } })}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commrails">CommRails</SelectItem>
                    <SelectItem value="google_workspace">Google Workspace</SelectItem>
                    <SelectItem value="microsoft_365">Microsoft 365</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.email.sendEnabled}
                    onChange={(e) => updateChannels({ email: { ...channels.email!, sendEnabled: e.target.checked } })}
                    className="size-4 accent-[var(--accent-primary)]"
                  />
                  Send
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.email.receiveEnabled}
                    onChange={(e) => updateChannels({ email: { ...channels.email!, receiveEnabled: e.target.checked } })}
                    className="size-4 accent-[var(--accent-primary)]"
                  />
                  Receive
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <Phone size={18} className="text-[var(--accent-primary)]" />
              Phone
            </div>
            {channels.phone ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateChannels({ phone: undefined })}
                className="text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
              >
                <Trash size={16} />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {agentId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={provisioning.phone}
                    onClick={() => provision('phone', () => provisionAgentPhone(agentId))}
                  >
                    {provisioning.phone ? '...' : <><Plus size={16} className="mr-1" /> Provision</>}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={pendingProvisioning.phone ? 'default' : 'outline'}
                    size="sm"
                    disabled={!onTogglePendingProvision}
                    onClick={() => onTogglePendingProvision?.('phone')}
                  >
                    {pendingProvisioning.phone ? (
                      <><CheckCircle size={16} className="mr-1" /> Will provision</>
                    ) : (
                      <><Plus size={16} className="mr-1" /> Provision on launch</>
                    )}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {provisionError.phone && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{provisionError.phone}</p>
          )}

          {channels.phone && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Number</Label>
                <Input
                  value={channels.phone.number}
                  onChange={(e) => updateChannels({ phone: { ...channels.phone!, number: e.target.value } })}
                  placeholder="+1 555 000 0000"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.phone.provider}
                  onValueChange={(value) => updateChannels({ phone: { ...channels.phone!, provider: value as AgentPhoneChannel['provider'] } })}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vapi">Vapi</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="telnyx">Telnyx</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.phone.voiceEnabled}
                    onChange={(e) => updateChannels({ phone: { ...channels.phone!, voiceEnabled: e.target.checked } })}
                    className="size-4 accent-[var(--accent-primary)]"
                  />
                  Voice
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.phone.smsEnabled}
                    onChange={(e) => updateChannels({ phone: { ...channels.phone!, smsEnabled: e.target.checked } })}
                    className="size-4 accent-[var(--accent-primary)]"
                  />
                  SMS
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Wallet */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <Wallet size={18} className="text-[var(--accent-primary)]" />
              Wallet
            </div>
            {channels.wallet ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateChannels({ wallet: undefined })}
                className="text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
              >
                <Trash size={16} />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {agentId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={provisioning.wallet}
                    onClick={() => provision('wallet', () => provisionAgentWallet(agentId))}
                  >
                    {provisioning.wallet ? '...' : <><Plus size={16} className="mr-1" /> Provision</>}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={pendingProvisioning.wallet ? 'default' : 'outline'}
                    size="sm"
                    disabled={!onTogglePendingProvision}
                    onClick={() => onTogglePendingProvision?.('wallet')}
                  >
                    {pendingProvisioning.wallet ? (
                      <><CheckCircle size={16} className="mr-1" /> Will provision</>
                    ) : (
                      <><Plus size={16} className="mr-1" /> Provision on launch</>
                    )}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addWallet}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {provisionError.wallet && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{provisionError.wallet}</p>
          )}

          {channels.wallet && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.wallet.provider}
                  onValueChange={(value) => updateChannels({ wallet: { ...channels.wallet!, provider: value as AgentWalletChannel['provider'] } })}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="etrid">Etrid (native)</SelectItem>
                    <SelectItem value="metamask">MetaMask</SelectItem>
                    <SelectItem value="coinbase_wallet">Coinbase Wallet</SelectItem>
                    <SelectItem value="rainbow">Rainbow</SelectItem>
                    <SelectItem value="phantom">Phantom</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                <Input
                  value={channels.wallet.address || ''}
                  onChange={(e) => updateChannels({ wallet: { ...channels.wallet!, address: e.target.value } })}
                  placeholder="0x... or address"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Chain ID</Label>
                <Input
                  value={String(channels.wallet.chainId || '')}
                  onChange={(e) => updateChannels({ wallet: { ...channels.wallet!, chainId: e.target.value } })}
                  placeholder="e.g. 1, 8453, solana"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Allowed Methods</Label>
                <div className="flex flex-wrap gap-3">
                  {(['send', 'receive', 'swap', 'stake', 'invoice'] as const).map((method) => (
                    <label key={method} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={channels.wallet!.allowedMethods?.includes(method) ?? false}
                        onChange={(e) => {
                          const current = channels.wallet!.allowedMethods || [];
                          const next = e.target.checked
                            ? [...current, method]
                            : current.filter((m) => m !== method);
                          updateChannels({ wallet: { ...channels.wallet!, allowedMethods: next } });
                        }}
                        className="size-4 accent-[var(--accent-primary)]"
                      />
                      <span className="capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Messaging */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 mt-4">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium mb-3">
            <Cloud size={18} className="text-[var(--accent-primary)]" />
            Cloud Messaging
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-3">
            Enable Photon-style orchestration and cross-surface sessions so this bot can act outside the chat surface.
          </p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={messaging.photonEnabled ?? false}
                onChange={(e) => updateMessaging({ photonEnabled: e.target.checked })}
                className="size-4 accent-[var(--accent-primary)]"
              />
              Photon orchestration
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={messaging.crossSurfaceEnabled ?? false}
                onChange={(e) => updateMessaging({ crossSurfaceEnabled: e.target.checked })}
                className="size-4 accent-[var(--accent-primary)]"
              />
              Cross-surface sessions
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
