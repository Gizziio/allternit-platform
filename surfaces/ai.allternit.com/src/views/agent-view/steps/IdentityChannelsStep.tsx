import React, { useEffect, useState } from "react";
import { Envelope, Phone, Wallet, Plus, Trash, Cloud, CheckCircle, Lightning } from "@phosphor-icons/react";
import type {
  CreateAgentInput,
  AgentIdentityChannels,
  AgentEmailChannel,
  AgentPhoneChannel,
  AgentWalletChannel,
  AgentMessagingConfig,
} from "@/lib/agents/agent.types";
import { Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { sealAgentSecret } from "@/lib/agents/agent-secrets.service";
import { createAgentWallet } from "@/lib/bots/agent-wallet-factory";
import { provisionAgentEmail, provisionAgentPhone } from "@/lib/bots/agent-identity.service";
import {
  getIdentityMappingForConnector,
  getConnectorAccountIdentifier,
  listIdentityConnectors,
} from "@/lib/bots/identity-connector-map";
import { connectOwned, listOwnedConnectors, type OwnedConnector } from "@/lib/design/owned-connector";

export interface PendingIdentityCredential {
  kind: 'email' | 'phone' | 'wallet';
  provider: string;
  address?: string;
  number?: string;
  password?: string;
  apiKey?: string;
  twilioSid?: string;
  twilioToken?: string;
  telnyxKey?: string;
  androidDeviceId?: string;
  seed?: string;
  chainId?: string;
}

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
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [connectError, setConnectError] = useState<Record<string, string>>({});
  const [connectStatus, setConnectStatus] = useState<Record<string, 'idle' | 'connected' | 'error'>>({});

  const [emailPassword, setEmailPassword] = useState("");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailImapHost, setEmailImapHost] = useState("");
  const [emailImapPort, setEmailImapPort] = useState("993");
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState("587");
  const [phoneTwilioSid, setPhoneTwilioSid] = useState("");
  const [phoneTwilioToken, setPhoneTwilioToken] = useState("");
  const [phoneTelnyxKey, setPhoneTelnyxKey] = useState("");
  const [phoneAndroidBaseUrl, setPhoneAndroidBaseUrl] = useState("");
  const [phoneAndroidDeviceId, setPhoneAndroidDeviceId] = useState("");
  const [phonePhotonProjectId, setPhonePhotonProjectId] = useState("");
  const [phonePhotonProjectSecret, setPhonePhotonProjectSecret] = useState("");
  const [phonePhotonLineId, setPhonePhotonLineId] = useState("");
  const [walletSeed, setWalletSeed] = useState("");
  const [walletKeyVaultRef, setWalletKeyVaultRef] = useState(formData.identityChannels?.wallet?.keyVaultRef || "");
  const [ownedConnectors, setOwnedConnectors] = useState<OwnedConnector[]>([]);

  useEffect(() => {
    if (!agentId) return;
    void listOwnedConnectors().then(setOwnedConnectors).catch(() => setOwnedConnectors([]));
  }, [agentId]);

  const channels = formData.identityChannels || {};
  const messaging = formData.messagingConfig || {};

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

  const ensureConnectorBinding = (connectorId: string, label: string, provider: string) => {
    setFormData((prev) => {
      const bindings = prev.connectorBindings ?? [];
      if (bindings.some((b) => b.connectorId === connectorId)) return prev;
      return {
        ...prev,
        connectorBindings: [
          ...bindings,
          { connectorId, provider, label, capabilities: ["send", "receive"], autonomous: true },
        ],
      };
    });
  };

  const applyConnectorToIdentity = (connector: OwnedConnector) => {
    const mapping = getIdentityMappingForConnector(connector.id);
    if (!mapping) return;
    const account = getConnectorAccountIdentifier(connector);

    if (mapping.kind === "email" && channels.email) {
      updateChannels({
        email: {
          ...channels.email,
          provider: mapping.provider as AgentEmailChannel["provider"],
          ...(account ? { address: account } : {}),
          sendEnabled: true,
          receiveEnabled: true,
        },
      });
      ensureConnectorBinding(connector.id, connector.name, mapping.provider);
      setConnectStatus((prev) => ({ ...prev, email: account ? "connected" : "idle" }));
    } else if (mapping.kind === "phone" && channels.phone) {
      updateChannels({
        phone: {
          ...channels.phone,
          provider: mapping.provider as AgentPhoneChannel["provider"],
          ...(account ? { number: account } : {}),
          voiceEnabled: true,
          smsEnabled: true,
        },
      });
      ensureConnectorBinding(connector.id, connector.name, mapping.provider);
      setConnectStatus((prev) => ({ ...prev, phone: account ? "connected" : "idle" }));
    }
  };

  const connectEmail = async () => {
    if (!agentId || !channels.email) return;
    setConnecting((prev) => ({ ...prev, email: true }));
    setConnectError((prev) => ({ ...prev, email: '' }));
    setConnectStatus((prev) => ({ ...prev, email: 'idle' }));
    try {
      if (channels.email.provider === "commrails" || channels.email.provider === "mailflare") {
        // Platform-managed mailbox: the backend provisions a real mailflare
        // mailbox when the mailflare rail is configured, otherwise falls back
        // to the legacy mint-only commrails row. The response says which.
        const result = await provisionAgentEmail(agentId);
        updateChannels({
          email: {
            ...channels.email,
            address: result.address,
            provider: result.provider,
            sendEnabled: true,
            receiveEnabled: true,
          },
        });
        setConnectStatus((prev) => ({ ...prev, email: 'connected' }));
        return;
      }

      const address = channels.email.address.trim();
      if (!address) throw new Error("Enter the email address to bind.");

      if (channels.email.provider === "google_workspace") {
        try {
          const result = await connectOwned("gmail", { via: "oauth2" });
          if (result.status === "connected") {
            ensureConnectorBinding("gmail", "Gmail", "gmail");
            setConnectStatus((prev) => ({ ...prev, email: 'connected' }));
          } else if (result.status === "authorization_required") {
            const url = (result as { authorize_url?: string }).authorize_url;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          } else {
            throw new Error("Gmail connection did not complete.");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("connector_not_found") || msg.includes("unknown_service")) {
            throw new Error("The Gmail connector is not available in this workspace yet. Use Generic IMAP/SMTP or CommRails instead.");
          }
          throw err;
        }
      } else if (channels.email.provider === "microsoft_365") {
        try {
          const result = await connectOwned("outlook", { via: "oauth2" });
          if (result.status === "connected") {
            ensureConnectorBinding("outlook", "Outlook", "outlook");
            setConnectStatus((prev) => ({ ...prev, email: 'connected' }));
          } else if (result.status === "authorization_required") {
            const url = (result as { authorize_url?: string }).authorize_url;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          } else {
            throw new Error("Outlook connection did not complete.");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("connector_not_found") || msg.includes("unknown_service")) {
            throw new Error("The Outlook connector is not available in this workspace yet. Use Generic IMAP/SMTP or CommRails instead.");
          }
          throw err;
        }
      } else if (channels.email.provider === "generic_imap") {
        const password = emailPassword.trim();
        const imapHost = emailImapHost.trim();
        const imapPort = emailImapPort.trim() || "993";
        const smtpHost = emailSmtpHost.trim();
        const smtpPort = emailSmtpPort.trim() || "587";
        if (!password) throw new Error("Enter the email password so the bot can authenticate.");
        if (!imapHost || !smtpHost) throw new Error("Enter the IMAP and SMTP server hosts.");
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_ADDRESS", value: address });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_PASSWORD", value: password });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_IMAP_HOST", value: imapHost });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_IMAP_PORT", value: imapPort });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_SMTP_HOST", value: smtpHost });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_SMTP_PORT", value: smtpPort });
        setConnectStatus((prev) => ({ ...prev, email: 'connected' }));
      } else {
        const password = emailPassword.trim();
        if (!password) throw new Error("Enter the email password so the bot can authenticate.");
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_ADDRESS", value: address });
        await sealAgentSecret({ agentId, key: "BOT_EMAIL_PASSWORD", value: password });
        setConnectStatus((prev) => ({ ...prev, email: 'connected' }));
      }
    } catch (err) {
      setConnectStatus((prev) => ({ ...prev, email: 'error' }));
      setConnectError((prev) => ({
        ...prev,
        email: err instanceof Error ? err.message : 'Email connection failed',
      }));
    } finally {
      setConnecting((prev) => ({ ...prev, email: false }));
    }
  };

  const connectPhone = async () => {
    if (!agentId || !channels.phone) return;
    setConnecting((prev) => ({ ...prev, phone: true }));
    setConnectError((prev) => ({ ...prev, phone: '' }));
    setConnectStatus((prev) => ({ ...prev, phone: 'idle' }));
    try {
      if (channels.phone.provider === "vapi") {
        const result = await provisionAgentPhone(agentId);
        updateChannels({
          phone: {
            ...channels.phone,
            number: result.number,
            provider: 'vapi',
            voiceEnabled: true,
            smsEnabled: true,
          },
        });
        setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
        return;
      }

      const number = channels.phone.number.trim();
      if (!number) throw new Error("Enter the phone number to bind.");

      if (channels.phone.provider === "twilio") {
        const accountSid = phoneTwilioSid.trim();
        const authToken = phoneTwilioToken.trim();
        if (!accountSid || !authToken) throw new Error("Enter your Twilio Account SID and Auth Token.");
        const result = await connectOwned("twilio", { via: "custom_credential", values: { accountSid, authToken } });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId, key: "TWILIO_ACCOUNT_SID", value: accountSid });
          await sealAgentSecret({ agentId, key: "TWILIO_AUTH_TOKEN", value: authToken });
          await sealAgentSecret({ agentId, key: "BOT_PHONE_NUMBER", value: number });
          ensureConnectorBinding("twilio", "Twilio", "twilio");
          setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
        } else {
          throw new Error("Twilio connection did not complete.");
        }
      } else if (channels.phone.provider === "telnyx") {
        const key = phoneTelnyxKey.trim();
        if (!key) throw new Error("Enter your Telnyx API key.");
        const result = await connectOwned("telnyx", { via: "api_key", api_key: key });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId, key: "TELNYX_API_KEY", value: key });
          await sealAgentSecret({ agentId, key: "BOT_PHONE_NUMBER", value: number });
          ensureConnectorBinding("telnyx", "Telnyx", "telnyx");
          setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
        } else {
          throw new Error("Telnyx connection did not complete.");
        }
      } else if (channels.phone.provider === "android_bridge") {
        const baseUrl = phoneAndroidBaseUrl.trim();
        const deviceId = phoneAndroidDeviceId.trim();
        if (!baseUrl) throw new Error("Enter the Android Bridge base URL.");
        if (!deviceId) throw new Error("Enter the paired Android device ID.");
        await sealAgentSecret({ agentId, key: "BOT_PHONE_NUMBER", value: number });
        await sealAgentSecret({ agentId, key: "ANDROID_BRIDGE_BASE_URL", value: baseUrl });
        await sealAgentSecret({ agentId, key: "ANDROID_BRIDGE_DEVICE_ID", value: deviceId });
        setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
      } else if (channels.phone.provider === "photon") {
        const projectId = phonePhotonProjectId.trim();
        const projectSecret = phonePhotonProjectSecret.trim();
        if (!projectId) throw new Error("Enter your Photon Project ID.");
        if (!projectSecret) throw new Error("Enter your Photon Project Secret.");
        await sealAgentSecret({ agentId, key: "PHOTON_PROJECT_ID", value: projectId });
        await sealAgentSecret({ agentId, key: "PHOTON_PROJECT_SECRET", value: projectSecret });
        await sealAgentSecret({ agentId, key: "BOT_PHONE_NUMBER", value: number });
        if (phonePhotonLineId.trim()) {
          await sealAgentSecret({ agentId, key: "PHOTON_LINE_ID", value: phonePhotonLineId.trim() });
        }
        setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
      } else {
        await sealAgentSecret({ agentId, key: "BOT_PHONE_NUMBER", value: number });
        setConnectStatus((prev) => ({ ...prev, phone: 'connected' }));
      }
    } catch (err) {
      setConnectStatus((prev) => ({ ...prev, phone: 'error' }));
      setConnectError((prev) => ({
        ...prev,
        phone: err instanceof Error ? err.message : 'Phone connection failed',
      }));
    } finally {
      setConnecting((prev) => ({ ...prev, phone: false }));
    }
  };

  const connectWallet = async () => {
    if (!agentId || !channels.wallet) return;
    setConnecting((prev) => ({ ...prev, wallet: true }));
    setConnectError((prev) => ({ ...prev, wallet: '' }));
    setConnectStatus((prev) => ({ ...prev, wallet: 'idle' }));
    try {
      if (channels.wallet.provider === "etrid") {
        let address = channels.wallet.address?.trim();
        let keyVaultRef: string | undefined = walletKeyVaultRef;
        if (!address) {
          const created = await createAgentWallet(agentId, 'etrid', {
            chainId: channels.wallet.chainId,
            allowedMethods: channels.wallet.allowedMethods as Array<'send' | 'receive' | 'swap' | 'stake' | 'invoice'>,
          });
          address = created.address || '';
          keyVaultRef = created.keyVaultRef;
          updateChannels({
            wallet: {
              ...channels.wallet,
              address,
              ...(keyVaultRef ? { keyVaultRef } : {}),
            },
          });
          setWalletKeyVaultRef(keyVaultRef || '');
        }
        if (!address) throw new Error("Etrid wallet creation did not return an address.");
        setConnectStatus((prev) => ({ ...prev, wallet: 'connected' }));
      } else {
        const address = channels.wallet.address?.trim();
        const seed = walletSeed.trim();
        if (!address) throw new Error("Enter the wallet address.");
        if (!seed) throw new Error("Enter the wallet seed / private key so the bot can sign transactions.");
        await sealAgentSecret({ agentId, key: "BOT_WALLET_ADDRESS", value: address });
        await sealAgentSecret({ agentId, key: "BOT_WALLET_SEED", value: seed });
        setConnectStatus((prev) => ({ ...prev, wallet: 'connected' }));
      }
    } catch (err) {
      setConnectStatus((prev) => ({ ...prev, wallet: 'error' }));
      setConnectError((prev) => ({
        ...prev,
        wallet: err instanceof Error ? err.message : 'Wallet connection failed',
      }));
    } finally {
      setConnecting((prev) => ({ ...prev, wallet: false }));
    }
  };

  const renderConnectButton = (kind: 'email' | 'phone' | 'wallet', action: () => Promise<void>, hasInput: boolean) => {
    if (!agentId) {
      return (
        <Button
          type="button"
          variant={pendingProvisioning[kind] ? 'default' : 'outline'}
          size="sm"
          disabled={!onTogglePendingProvision}
          onClick={() => onTogglePendingProvision?.(kind)}
        >
          {pendingProvisioning[kind] ? (
            <><CheckCircle size={16} className="mr-1" /> Will bind on launch</>
          ) : (
            <><Plus size={16} className="mr-1" /> Bind on launch</>
          )}
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={connecting[kind] || !hasInput}
        onClick={() => void action()}
      >
        {connecting[kind] ? 'Connecting…' : <><Lightning size={16} className="mr-1" /> Connect</>}
      </Button>
    );
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
            Bind real email, phone, and wallet accounts the bot will use autonomously. Credentials are sealed in the vault and connected through the owned-connector stack.
          </p>
        </div>

        {/* Email */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <Envelope size={18} className="text-[var(--accent-primary)]" />
              Email
              {connectStatus.email === 'connected' && agentId && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
              )}
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
                {renderConnectButton('email', connectEmail, false)}
                <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {connectError.email && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{connectError.email}</p>
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
              {listIdentityConnectors(ownedConnectors, "email").filter((c) => c.connection?.status === "connected").length > 0 && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Use connected email connector</Label>
                  <select
                    value=""
                    onChange={(e) => {
                      const connector = ownedConnectors.find((c) => c.id === e.target.value);
                      if (connector) applyConnectorToIdentity(connector);
                    }}
                    className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[13px] px-2"
                  >
                    <option value="">— select a connected connector —</option>
                    {listIdentityConnectors(ownedConnectors, "email")
                      .filter((c) => c.connection?.status === "connected")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.connection?.account ? `(${c.connection.account})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.email.provider}
                  onValueChange={(value) => {
                    updateChannels({ email: { ...channels.email!, provider: value as AgentEmailChannel['provider'] } });
                    setConnectStatus((prev) => ({ ...prev, email: 'idle' }));
                  }}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commrails">CommRails (platform email)</SelectItem>
                    <SelectItem value="mailflare">Agent Mail (mailflare)</SelectItem>
                    <SelectItem value="google_workspace">Gmail / Google Workspace</SelectItem>
                    <SelectItem value="microsoft_365">Outlook / Microsoft 365</SelectItem>
                    <SelectItem value="generic_imap">Generic IMAP/SMTP</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(channels.email.provider === "commrails" || channels.email.provider === "mailflare") && (
                <div className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Platform email provisions a platform-managed mailbox — a real Agent Mail
                    (mailflare) mailbox when the mailflare rail is configured, otherwise the
                    legacy CommRails mint. The backend generates the address and credentials;
                    click Connect to allocate one. Outbound sends are approval-gated and appear
                    as review cards in Agent Activity.
                  </p>
                </div>
              )}
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
              {(channels.email.provider === "generic_imap" || channels.email.provider === "custom") && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Password</Label>
                  <Input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="The bot needs this to sign in to the mailbox."
                    className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              )}
              {channels.email.provider === "generic_imap" && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">IMAP host</Label>
                    <Input
                      value={emailImapHost}
                      onChange={(e) => setEmailImapHost(e.target.value)}
                      placeholder="imap.example.com"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">IMAP port</Label>
                    <Input
                      value={emailImapPort}
                      onChange={(e) => setEmailImapPort(e.target.value)}
                      placeholder="993"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">SMTP host</Label>
                    <Input
                      value={emailSmtpHost}
                      onChange={(e) => setEmailSmtpHost(e.target.value)}
                      placeholder="smtp.example.com"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">SMTP port</Label>
                    <Input
                      value={emailSmtpPort}
                      onChange={(e) => setEmailSmtpPort(e.target.value)}
                      placeholder="587"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </>
              )}
              <div className="sm:col-span-2 flex justify-end">
                {agentId && renderConnectButton('email', connectEmail, channels.email.provider === 'commrails' || channels.email.provider === 'mailflare' || channels.email.address.trim().length > 0)}
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
              {connectStatus.phone === 'connected' && agentId && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
              )}
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
                {renderConnectButton('phone', connectPhone, false)}
                <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {connectError.phone && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{connectError.phone}</p>
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
              {listIdentityConnectors(ownedConnectors, "phone").filter((c) => c.connection?.status === "connected").length > 0 && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Use connected phone connector</Label>
                  <select
                    value=""
                    onChange={(e) => {
                      const connector = ownedConnectors.find((c) => c.id === e.target.value);
                      if (connector) applyConnectorToIdentity(connector);
                    }}
                    className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[13px] px-2"
                  >
                    <option value="">— select a connected connector —</option>
                    {listIdentityConnectors(ownedConnectors, "phone")
                      .filter((c) => c.connection?.status === "connected")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.connection?.account ? `(${c.connection.account})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.phone.provider}
                  onValueChange={(value) => {
                    updateChannels({ phone: { ...channels.phone!, provider: value as AgentPhoneChannel['provider'] } });
                    setConnectStatus((prev) => ({ ...prev, phone: 'idle' }));
                  }}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vapi">Vapi (platform number)</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="telnyx">Telnyx</SelectItem>
                    <SelectItem value="android_bridge">Android Bridge (real device)</SelectItem>
                    <SelectItem value="photon">Photon.codes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {channels.phone.provider === "vapi" && (
                <div className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Vapi provisions a platform-managed phone number from the pool. Click
                    Connect to allocate one.
                  </p>
                </div>
              )}
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
              {channels.phone.provider === "twilio" && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Twilio Account SID</Label>
                    <Input
                      value={phoneTwilioSid}
                      onChange={(e) => setPhoneTwilioSid(e.target.value)}
                      placeholder="AC..."
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Twilio Auth Token</Label>
                    <Input
                      type="password"
                      value={phoneTwilioToken}
                      onChange={(e) => setPhoneTwilioToken(e.target.value)}
                      placeholder="your_auth_token"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </>
              )}
              {channels.phone.provider === "telnyx" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Telnyx API key</Label>
                  <Input
                    type="password"
                    value={phoneTelnyxKey}
                    onChange={(e) => setPhoneTelnyxKey(e.target.value)}
                    placeholder="KEY..."
                    className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              )}
              {channels.phone.provider === "android_bridge" && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Android Bridge base URL</Label>
                    <Input
                      value={phoneAndroidBaseUrl}
                      onChange={(e) => setPhoneAndroidBaseUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8020"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Paired Android device ID</Label>
                    <Input
                      value={phoneAndroidDeviceId}
                      onChange={(e) => setPhoneAndroidDeviceId(e.target.value)}
                      placeholder="device-uuid-or-serial"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </>
              )}
              {channels.phone.provider === "photon" && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Photon Project ID</Label>
                    <Input
                      value={phonePhotonProjectId}
                      onChange={(e) => setPhonePhotonProjectId(e.target.value)}
                      placeholder="proj_..."
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">Photon Project Secret</Label>
                    <Input
                      type="password"
                      value={phonePhotonProjectSecret}
                      onChange={(e) => setPhonePhotonProjectSecret(e.target.value)}
                      placeholder="your_project_secret"
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[12px] text-[var(--text-secondary)]">
                      Line ID <span className="text-[var(--text-tertiary)]">(optional)</span>
                    </Label>
                    <Input
                      value={phonePhotonLineId}
                      onChange={(e) => setPhonePhotonLineId(e.target.value)}
                      placeholder="line_..."
                      className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] mb-1">Photon.codes free tier</p>
                    <ul className="text-[12px] text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                      <li>Shared iMessage line on the free tier</li>
                      <li>Rate limits apply</li>
                      <li>Dedicated lines require an upgrade</li>
                    </ul>
                  </div>
                </>
              )}
              <div className="sm:col-span-2 flex justify-end">
                {agentId && renderConnectButton('phone', connectPhone, channels.phone.provider === 'vapi' || channels.phone.number.trim().length > 0)}
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
              {connectStatus.wallet === 'connected' && agentId && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
              )}
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
                {renderConnectButton('wallet', connectWallet, false)}
                <Button type="button" variant="outline" size="sm" onClick={addWallet}>
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
          {connectError.wallet && (
            <p className="text-[12px] text-[var(--status-error)] mb-2">{connectError.wallet}</p>
          )}

          {channels.wallet && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                <Select
                  value={channels.wallet.provider}
                  onValueChange={(value) => {
                    updateChannels({ wallet: { ...channels.wallet!, provider: value as AgentWalletChannel['provider'] } });
                    setConnectStatus((prev) => ({ ...prev, wallet: 'idle' }));
                  }}
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
                <Label className="text-[12px] text-[var(--text-secondary)]">Chain ID</Label>
                <Input
                  value={String(channels.wallet.chainId || '')}
                  onChange={(e) => updateChannels({ wallet: { ...channels.wallet!, chainId: e.target.value } })}
                  placeholder="e.g. 1, 8453, solana"
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                <Input
                  value={channels.wallet.address || ''}
                  onChange={(e) => updateChannels({ wallet: { ...channels.wallet!, address: e.target.value } })}
                  placeholder={channels.wallet.provider === "etrid" ? "Enter the Etrid address" : "0x... or address"}
                  className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              {channels.wallet.provider !== "etrid" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Seed / private key</Label>
                  <Input
                    type="password"
                    value={walletSeed}
                    onChange={(e) => setWalletSeed(e.target.value)}
                    placeholder="Sealed in the vault; used by the bot to sign transactions."
                    className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
              )}
              {channels.wallet.provider === "etrid" && (
                <div className="sm:col-span-2 text-[12px] text-[var(--text-tertiary)]">
                  Etrid wallets are managed natively. Enter the address above; the private key stays in the Etrid vault.
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
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
              <div className="sm:col-span-2 flex justify-end">
                {agentId && renderConnectButton(
                  'wallet',
                  connectWallet,
                  channels.wallet.provider === 'etrid' || (channels.wallet.address || '').trim().length > 0,
                )}
              </div>
            </div>
          )}
        </div>

        {/* Photon / Cloud Messaging */}
        <div className="rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <Cloud size={18} className="text-[var(--accent-primary)]" />
              Photon Cloud Messaging
              {messaging.photonEnabled && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Enabled</span>
              )}
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-3">
            Native orchestration bus for cross-surface sessions and cloud handoffs. This is separate from phone providers.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={messaging.photonEnabled ?? false}
                  onChange={(e) => updateMessaging({ photonEnabled: e.target.checked })}
                  className="size-4 accent-[var(--accent-primary)]"
                />
                Enable Photon orchestration
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
            {messaging.photonEnabled && (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Photon endpoint / topic</Label>
                  <Input
                    value={messaging.photonEndpoint || ''}
                    onChange={(e) => updateMessaging({ photonEndpoint: e.target.value })}
                    placeholder="photon://agents/{bot-id} or wss://photon.allternit.com/..."
                    className="bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[12px] text-[var(--text-secondary)]">Allowed surfaces</Label>
                  <div className="flex flex-wrap gap-3">
                    {([
                      { id: 'chat' as const, label: 'Chat' },
                      { id: 'cowork' as const, label: 'CoWork' },
                      { id: 'code' as const, label: 'Code' },
                      { id: 'design' as const, label: 'Design' },
                      { id: 'browser' as const, label: 'Browser' },
                    ]).map((surface) => (
                      <label key={surface.id} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(messaging.allowedSurfaces ?? []).includes(surface.id)}
                          onChange={(e) => {
                            const current = messaging.allowedSurfaces ?? [];
                            updateMessaging({
                              allowedSurfaces: e.target.checked
                                ? [...current, surface.id]
                                : current.filter((s) => s !== surface.id),
                            });
                          }}
                          className="size-4 accent-[var(--accent-primary)]"
                        />
                        {surface.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
