"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plugs, Key, Plus, Trash, Lightning, Robot, Envelope, Phone, Wallet, ComputerTower, Desktop, Globe, FileCode, Terminal, SquaresFour, Cloud } from "@phosphor-icons/react";
import type { Agent, AgentConnectorBinding, AgentSecretRef, AgentWalletPaymentMethod, AgentEmailChannel, AgentPhoneChannel, AgentWalletChannel, AgentMessagingConfig, AgentVMAction, AgentVMProvider, AgentVMNetworkPolicy, AgentVMPersistence } from "@/lib/agents/agent.types";
import { updateAgent } from "@/lib/agents/agent.service";
import { sealAgentSecret } from "@/lib/agents/agent-secrets.service";
import { createAgentWallet } from "@/lib/bots/agent-wallet-factory";
import {
  getIdentityMappingForConnector,
  getConnectorAccountIdentifier,
  listIdentityConnectors,
} from "@/lib/bots/identity-connector-map";
import { connectOwned, listOwnedConnectors, type OwnedConnector } from "@/lib/design/owned-connector";
import { ConnectorMarketplace } from "@/components/marketplace/ConnectorMarketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";

type RuntimeSection = "connectors" | "secrets" | "harness" | "identity" | "vm";

interface BotRuntimeConfigModalProps {
  bot: Agent;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialSection?: RuntimeSection;
}

function connectorProviderSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "connector";
}

export function BotRuntimeConfigModal({ bot, isOpen, onClose, onSaved, initialSection = "connectors" }: BotRuntimeConfigModalProps) {
  const [activeSection, setActiveSection] = useState<RuntimeSection>(initialSection);

  const [bindings, setBindings] = useState<AgentConnectorBinding[]>(bot.connectorBindings ?? []);
  const boundIds = useMemo(() => new Set(bindings.map((b) => b.connectorId)), [bindings]);
  const [secrets, setSecrets] = useState<AgentSecretRef[]>(bot.secretRefs ?? []);
  const [secretValues, setSecretValues] = useState<Record<number, string>>({});

  const [harnessMode, setHarnessMode] = useState(bot.harness?.mode || "cloud");
  const [byokAnthropicKey, setByokAnthropicKey] = useState(bot.harness?.byok?.anthropic?.apiKey || "");
  const [byokOpenAIKey, setByokOpenAIKey] = useState(bot.harness?.byok?.openai?.apiKey || "");
  const [byokGoogleKey, setByokGoogleKey] = useState(bot.harness?.byok?.google?.apiKey || "");

  const [emailAddress, setEmailAddress] = useState(bot.identityChannels?.email?.address || "");
  const [emailProvider, setEmailProvider] = useState(bot.identityChannels?.email?.provider || "commrails");
  const [emailSend, setEmailSend] = useState(bot.identityChannels?.email?.sendEnabled ?? true);
  const [emailReceive, setEmailReceive] = useState(bot.identityChannels?.email?.receiveEnabled ?? true);

  const [phoneNumber, setPhoneNumber] = useState(bot.identityChannels?.phone?.number || "");
  const [phoneProvider, setPhoneProvider] = useState(bot.identityChannels?.phone?.provider || "vapi");
  const [phoneVoice, setPhoneVoice] = useState(bot.identityChannels?.phone?.voiceEnabled ?? true);
  const [phoneSms, setPhoneSms] = useState(bot.identityChannels?.phone?.smsEnabled ?? true);

  const [walletAddress, setWalletAddress] = useState(bot.identityChannels?.wallet?.address || "");
  const [walletProvider, setWalletProvider] = useState(bot.identityChannels?.wallet?.provider || "etrid");
  const [walletChainId, setWalletChainId] = useState(String(bot.identityChannels?.wallet?.chainId || ""));
  const [walletMethods, setWalletMethods] = useState<string[]>(bot.identityChannels?.wallet?.allowedMethods || ["receive", "invoice"]);
  const [walletKeyVaultRef, setWalletKeyVaultRef] = useState(bot.identityChannels?.wallet?.keyVaultRef || "");

  const [messagingEnabled, setMessagingEnabled] = useState(bot.messagingConfig?.photonEnabled ?? false);
  const [messagingEndpoint, setMessagingEndpoint] = useState(bot.messagingConfig?.photonEndpoint || "");
  const [messagingCrossSurface, setMessagingCrossSurface] = useState(bot.messagingConfig?.crossSurfaceEnabled ?? false);
  const [messagingSurfaces, setMessagingSurfaces] = useState<AgentMessagingConfig["allowedSurfaces"]>(
    bot.messagingConfig?.allowedSurfaces ?? ["chat", "cowork", "code"]
  );

  const [vmEnabled, setVMEnabled] = useState(bot.vmOperator?.enabled ?? false);
  const [vmProvider, setVMProvider] = useState<AgentVMProvider>(bot.vmOperator?.provider || "opensandbox");
  const [vmImage, setVMImage] = useState(bot.vmOperator?.image || "");
  const [vmCpu, setVMCpu] = useState(bot.vmOperator?.resources?.cpu || "");
  const [vmMemory, setVMMemory] = useState(bot.vmOperator?.resources?.memory || "");
  const [vmDisk, setVMDisk] = useState(bot.vmOperator?.resources?.disk || "");
  const [vmActions, setVMActions] = useState<AgentVMAction[]>(bot.vmOperator?.allowedActions || []);
  const [vmNetworkPolicy, setVMNetworkPolicy] = useState<AgentVMNetworkPolicy>(bot.vmOperator?.networkPolicy || "restricted");
  const [vmPersistence, setVMPersistence] = useState<AgentVMPersistence>(bot.vmOperator?.persistence || "session");
  const [vmTimeout, setVMTimeout] = useState(bot.vmOperator?.timeoutMinutes ?? 30);
  const [vmVncEnabled, setVMVncEnabled] = useState(bot.vmOperator?.vncEnabled ?? false);
  const [vmAutoStart, setVMAutoStart] = useState(bot.vmOperator?.autoStart ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownedConnectors, setOwnedConnectors] = useState<OwnedConnector[]>([]);

  const refreshOwnedConnectors = useCallback(async (): Promise<OwnedConnector[]> => {
    try {
      const list = await listOwnedConnectors();
      setOwnedConnectors(list);
      return list;
    } catch {
      setOwnedConnectors([]);
      return [];
    }
  }, []);

  // Identity channel credentials (never persisted in React state beyond this modal; sealed as secrets).
  const [emailPassword, setEmailPassword] = useState("");
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailImapHost, setEmailImapHost] = useState("");
  const [emailImapPort, setEmailImapPort] = useState("993");
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState("587");
  const [emailConnecting, setEmailConnecting] = useState(false);
  const [emailConnectionStatus, setEmailConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

  const [phoneTwilioSid, setPhoneTwilioSid] = useState("");
  const [phoneTwilioToken, setPhoneTwilioToken] = useState("");
  const [phoneTelnyxKey, setPhoneTelnyxKey] = useState("");
  const [phoneAndroidBaseUrl, setPhoneAndroidBaseUrl] = useState("");
  const [phoneAndroidDeviceId, setPhoneAndroidDeviceId] = useState("");
  const [phonePhotonProjectId, setPhonePhotonProjectId] = useState("");
  const [phonePhotonProjectSecret, setPhonePhotonProjectSecret] = useState("");
  const [phonePhotonLineId, setPhonePhotonLineId] = useState("");
  const [phoneConnecting, setPhoneConnecting] = useState(false);
  const [phoneConnectionStatus, setPhoneConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

  const [walletSeed, setWalletSeed] = useState("");
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletConnectionStatus, setWalletConnectionStatus] = useState<"idle" | "connected" | "error">("idle");

  const [identityErrors, setIdentityErrors] = useState<{ email?: string; phone?: string; wallet?: string }>({});

  useEffect(() => {
    if (isOpen) {
      void refreshOwnedConnectors();
      setActiveSection(initialSection);
      setBindings(bot.connectorBindings ?? []);
      setSecrets(bot.secretRefs ?? []);
      setSecretValues({});
      setHarnessMode(bot.harness?.mode || "cloud");
      setByokAnthropicKey(bot.harness?.byok?.anthropic?.apiKey || "");
      setByokOpenAIKey(bot.harness?.byok?.openai?.apiKey || "");
      setByokGoogleKey(bot.harness?.byok?.google?.apiKey || "");
      setEmailAddress(bot.identityChannels?.email?.address || "");
      setEmailProvider(bot.identityChannels?.email?.provider || "commrails");
      setEmailSend(bot.identityChannels?.email?.sendEnabled ?? true);
      setEmailReceive(bot.identityChannels?.email?.receiveEnabled ?? true);
      setEmailPassword("");
      setEmailApiKey("");
      setEmailImapHost("");
      setEmailImapPort("993");
      setEmailSmtpHost("");
      setEmailSmtpPort("587");
      setEmailConnecting(false);
      setEmailConnectionStatus("idle");
      setPhoneNumber(bot.identityChannels?.phone?.number || "");
      setPhoneProvider(bot.identityChannels?.phone?.provider || "vapi");
      setPhoneVoice(bot.identityChannels?.phone?.voiceEnabled ?? true);
      setPhoneSms(bot.identityChannels?.phone?.smsEnabled ?? true);
      setPhoneTwilioSid("");
      setPhoneTwilioToken("");
      setPhoneTelnyxKey("");
      setPhoneAndroidBaseUrl("");
      setPhoneAndroidDeviceId("");
      setPhonePhotonProjectId("");
      setPhonePhotonProjectSecret("");
      setPhonePhotonLineId("");
      setPhoneConnecting(false);
      setPhoneConnectionStatus("idle");
      setWalletAddress(bot.identityChannels?.wallet?.address || "");
      setWalletProvider(bot.identityChannels?.wallet?.provider || "etrid");
      setWalletChainId(String(bot.identityChannels?.wallet?.chainId || ""));
      setWalletMethods(bot.identityChannels?.wallet?.allowedMethods || ["receive", "invoice"]);
      setWalletKeyVaultRef(bot.identityChannels?.wallet?.keyVaultRef || "");
      setWalletSeed("");
      setWalletConnecting(false);
      setWalletConnectionStatus("idle");
      setIdentityErrors({});
      setMessagingEnabled(bot.messagingConfig?.photonEnabled ?? false);
      setMessagingEndpoint(bot.messagingConfig?.photonEndpoint || "");
      setMessagingCrossSurface(bot.messagingConfig?.crossSurfaceEnabled ?? false);
      setMessagingSurfaces(bot.messagingConfig?.allowedSurfaces ?? ["chat", "cowork", "code"]);
      setVMEnabled(bot.vmOperator?.enabled ?? false);
      setVMProvider(bot.vmOperator?.provider || "opensandbox");
      setVMImage(bot.vmOperator?.image || "");
      setVMCpu(bot.vmOperator?.resources?.cpu || "");
      setVMMemory(bot.vmOperator?.resources?.memory || "");
      setVMDisk(bot.vmOperator?.resources?.disk || "");
      setVMActions(bot.vmOperator?.allowedActions || []);
      setVMNetworkPolicy(bot.vmOperator?.networkPolicy || "restricted");
      setVMPersistence(bot.vmOperator?.persistence || "session");
      setVMTimeout(bot.vmOperator?.timeoutMinutes ?? 30);
      setVMVncEnabled(bot.vmOperator?.vncEnabled ?? false);
      setVMAutoStart(bot.vmOperator?.autoStart ?? true);
      setError(null);
    }
  }, [isOpen, initialSection, bot]);

  const applyConnectorToIdentity = useCallback((connector: OwnedConnector) => {
    const mapping = getIdentityMappingForConnector(connector.id);
    if (!mapping) return;

    const account = getConnectorAccountIdentifier(connector);
    if (mapping.kind === "email") {
      setEmailProvider(mapping.provider as AgentEmailChannel["provider"]);
      if (account) setEmailAddress(account);
      setEmailSend(true);
      setEmailReceive(true);
      setEmailConnectionStatus(account ? "connected" : "idle");
    } else if (mapping.kind === "phone") {
      setPhoneProvider(mapping.provider as AgentPhoneChannel["provider"]);
      if (account) setPhoneNumber(account);
      setPhoneVoice(true);
      setPhoneSms(true);
      setPhoneConnectionStatus(account ? "connected" : "idle");
    }
  }, []);

  const bindConnector = useCallback((connector: OwnedConnector) => {
    setBindings((prev) => {
      if (prev.some((b) => b.connectorId === connector.id)) return prev;
      const next: AgentConnectorBinding = {
        connectorId: connector.id,
        provider: connectorProviderSlug(connector.name),
        label: connector.name,
        capabilities: ["connect"],
        autonomous: true,
      };
      return [...prev, next];
    });
    void refreshOwnedConnectors().then((list) => {
      const fresh = list.find((c) => c.id === connector.id) || connector;
      applyConnectorToIdentity(fresh);
    });
  }, [applyConnectorToIdentity, refreshOwnedConnectors]);

  const unbindConnector = useCallback((connector: OwnedConnector) => {
    setBindings((prev) => prev.filter((b) => b.connectorId !== connector.id));
  }, []);

  const removeBinding = useCallback((connectorId: string) => {
    setBindings((prev) => prev.filter((b) => b.connectorId !== connectorId));
  }, []);

  const addSecret = useCallback(() => {
    setSecrets((prev) => [...prev, { name: "", key: "", description: "", required: true }]);
  }, []);

  const updateSecret = useCallback((index: number, updates: Partial<AgentSecretRef>) => {
    setSecrets((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  const removeSecret = useCallback((index: number) => {
    setSecrets((prev) => prev.filter((_, i) => i !== index));
    setSecretValues((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const toggleWalletMethod = useCallback((method: string) => {
    setWalletMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }, []);

  const ensureConnectorBinding = useCallback((connectorId: string, label: string, provider: string) => {
    setBindings((prev) => {
      if (prev.some((b) => b.connectorId === connectorId)) return prev;
      return [
        ...prev,
        {
          connectorId,
          provider,
          label,
          capabilities: ["send", "receive"],
          autonomous: true,
        },
      ];
    });
  }, []);

  const handleConnectEmail = useCallback(async () => {
    setEmailConnecting(true);
    setIdentityErrors((prev) => ({ ...prev, email: undefined }));
    setEmailConnectionStatus("idle");
    try {
      if (!emailAddress.trim()) throw new Error("Enter the email address to bind.");
      const address = emailAddress.trim();

      if (emailProvider === "google_workspace") {
        const result = await connectOwned("gmail", { via: "oauth2" });
        if (result.status === "connected") {
          ensureConnectorBinding("gmail", "Gmail", "gmail");
          setEmailConnectionStatus("connected");
        } else if (result.status === "authorization_required") {
          const url = (result as { authorize_url?: string }).authorize_url;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } else {
          throw new Error("Gmail connection did not complete.");
        }
      } else if (emailProvider === "microsoft_365") {
        const result = await connectOwned("outlook", { via: "oauth2" });
        if (result.status === "connected") {
          ensureConnectorBinding("outlook", "Outlook", "outlook");
          setEmailConnectionStatus("connected");
        } else if (result.status === "authorization_required") {
          const url = (result as { authorize_url?: string }).authorize_url;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } else {
          throw new Error("Outlook connection did not complete.");
        }
      } else if (emailProvider === "agent_mail") {
        const key = emailApiKey.trim();
        if (!key) throw new Error("Enter your AgentMail API key.");
        const result = await connectOwned("agent-mail", { via: "api_key", api_key: key });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId: bot.id, key: "AGENT_MAIL_API_KEY", value: key });
          ensureConnectorBinding("agent-mail", "AgentMail", "agent_mail");
          setEmailConnectionStatus("connected");
        } else {
          throw new Error("AgentMail connection failed.");
        }
      } else if (emailProvider === "generic_imap") {
        const password = emailPassword.trim();
        const imapHost = emailImapHost.trim();
        const imapPort = emailImapPort.trim() || "993";
        const smtpHost = emailSmtpHost.trim();
        const smtpPort = emailSmtpPort.trim() || "587";
        if (!password) throw new Error("Enter the email password so the bot can authenticate.");
        if (!imapHost || !smtpHost) throw new Error("Enter the IMAP and SMTP server hosts.");
        const result = await connectOwned("generic-email", {
          via: "custom_credential",
          values: {
            email: address,
            password,
            imapHost,
            imapPort,
            smtpHost,
            smtpPort,
          },
        });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_ADDRESS", value: address });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_PASSWORD", value: password });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_IMAP_HOST", value: imapHost });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_IMAP_PORT", value: imapPort });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_SMTP_HOST", value: smtpHost });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_SMTP_PORT", value: smtpPort });
          ensureConnectorBinding("generic-email", "Generic Email (IMAP/SMTP)", "generic_email");
          setEmailConnectionStatus("connected");
        } else {
          throw new Error("Generic email connection failed.");
        }
      } else {
        // custom / commrails: seal address + password so the runtime can use them.
        const password = emailPassword.trim();
        if (!password) throw new Error("Enter the email password so the bot can authenticate.");
        await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_ADDRESS", value: address });
        await sealAgentSecret({ agentId: bot.id, key: "BOT_EMAIL_PASSWORD", value: password });
        setEmailConnectionStatus("connected");
      }
    } catch (err) {
      setEmailConnectionStatus("error");
      setIdentityErrors((prev) => ({
        ...prev,
        email: err instanceof Error ? err.message : "Email connection failed",
      }));
    } finally {
      setEmailConnecting(false);
    }
  }, [bot.id, emailAddress, emailProvider, emailApiKey, emailPassword, emailImapHost, emailImapPort, emailSmtpHost, emailSmtpPort, ensureConnectorBinding]);

  const handleConnectPhone = useCallback(async () => {
    setPhoneConnecting(true);
    setIdentityErrors((prev) => ({ ...prev, phone: undefined }));
    setPhoneConnectionStatus("idle");
    try {
      if (!phoneNumber.trim()) throw new Error("Enter the phone number to bind.");
      const number = phoneNumber.trim();

      if (phoneProvider === "twilio") {
        const accountSid = phoneTwilioSid.trim();
        const authToken = phoneTwilioToken.trim();
        if (!accountSid || !authToken) throw new Error("Enter your Twilio Account SID and Auth Token.");
        const result = await connectOwned("twilio", {
          via: "custom_credential",
          values: { accountSid, authToken },
        });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId: bot.id, key: "TWILIO_ACCOUNT_SID", value: accountSid });
          await sealAgentSecret({ agentId: bot.id, key: "TWILIO_AUTH_TOKEN", value: authToken });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_PHONE_NUMBER", value: number });
          ensureConnectorBinding("twilio", "Twilio", "twilio");
          setPhoneConnectionStatus("connected");
        } else {
          throw new Error("Twilio connection failed.");
        }
      } else if (phoneProvider === "telnyx") {
        const key = phoneTelnyxKey.trim();
        if (!key) throw new Error("Enter your Telnyx API key.");
        const result = await connectOwned("telnyx", { via: "api_key", api_key: key });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId: bot.id, key: "TELNYX_API_KEY", value: key });
          await sealAgentSecret({ agentId: bot.id, key: "BOT_PHONE_NUMBER", value: number });
          ensureConnectorBinding("telnyx", "Telnyx", "telnyx");
          setPhoneConnectionStatus("connected");
        } else {
          throw new Error("Telnyx connection failed.");
        }
      } else if (phoneProvider === "android_bridge") {
        const baseUrl = phoneAndroidBaseUrl.trim();
        const deviceId = phoneAndroidDeviceId.trim();
        if (!baseUrl) throw new Error("Enter the Android Bridge base URL.");
        if (!deviceId) throw new Error("Enter the paired Android device ID.");
        const result = await connectOwned("android-bridge", {
          via: "custom_credential",
          values: { baseUrl, deviceId },
        });
        if (result.status === "connected") {
          await sealAgentSecret({ agentId: bot.id, key: "BOT_PHONE_NUMBER", value: number });
          await sealAgentSecret({ agentId: bot.id, key: "ANDROID_BRIDGE_BASE_URL", value: baseUrl });
          await sealAgentSecret({ agentId: bot.id, key: "ANDROID_BRIDGE_DEVICE_ID", value: deviceId });
          ensureConnectorBinding("android-bridge", "Android Bridge", "android_bridge");
          setPhoneConnectionStatus("connected");
        } else {
          throw new Error("Android Bridge connection failed.");
        }
      } else if (phoneProvider === "photon") {
        const projectId = phonePhotonProjectId.trim();
        const projectSecret = phonePhotonProjectSecret.trim();
        if (!projectId) throw new Error("Enter your Photon Project ID.");
        if (!projectSecret) throw new Error("Enter your Photon Project Secret.");
        await sealAgentSecret({ agentId: bot.id, key: "PHOTON_PROJECT_ID", value: projectId });
        await sealAgentSecret({ agentId: bot.id, key: "PHOTON_PROJECT_SECRET", value: projectSecret });
        await sealAgentSecret({ agentId: bot.id, key: "BOT_PHONE_NUMBER", value: number });
        if (phonePhotonLineId.trim()) {
          await sealAgentSecret({ agentId: bot.id, key: "PHOTON_LINE_ID", value: phonePhotonLineId.trim() });
        }
        ensureConnectorBinding("photon", "Photon.codes", "photon");
        setPhoneConnectionStatus("connected");
      } else {
        // vapi / generic: just seal the number for now.
        await sealAgentSecret({ agentId: bot.id, key: "BOT_PHONE_NUMBER", value: number });
        setPhoneConnectionStatus("connected");
      }
    } catch (err) {
      setPhoneConnectionStatus("error");
      setIdentityErrors((prev) => ({
        ...prev,
        phone: err instanceof Error ? err.message : "Phone connection failed",
      }));
    } finally {
      setPhoneConnecting(false);
    }
  }, [
    bot.id,
    phoneNumber,
    phoneProvider,
    phoneTwilioSid,
    phoneTwilioToken,
    phoneTelnyxKey,
    phoneAndroidBaseUrl,
    phoneAndroidDeviceId,
    phonePhotonProjectId,
    phonePhotonProjectSecret,
    phonePhotonLineId,
    ensureConnectorBinding,
  ]);

  const handleConnectWallet = useCallback(async () => {
    setWalletConnecting(true);
    setIdentityErrors((prev) => ({ ...prev, wallet: undefined }));
    setWalletConnectionStatus("idle");
    try {
      if (walletProvider === "etrid") {
        let address = walletAddress.trim();
        let keyVaultRef: string | undefined = bot.identityChannels?.wallet?.keyVaultRef;
        if (!address) {
          const created = await createAgentWallet(bot.id, "etrid", {
            chainId: walletChainId.trim() || undefined,
            allowedMethods: walletMethods as Array<"send" | "receive" | "swap" | "stake" | "invoice">,
          });
          address = created.address || "";
          keyVaultRef = created.keyVaultRef;
          setWalletAddress(address);
        }
        if (!address) throw new Error("Etrid wallet creation did not return an address.");
        if (keyVaultRef) setWalletKeyVaultRef(keyVaultRef);
        setWalletConnectionStatus("connected");
      } else {
        const address = walletAddress.trim();
        const seed = walletSeed.trim();
        if (!address) throw new Error("Enter the wallet address.");
        if (!seed) throw new Error("Enter the wallet seed / private key so the bot can sign transactions.");
        await sealAgentSecret({ agentId: bot.id, key: "BOT_WALLET_ADDRESS", value: address });
        await sealAgentSecret({ agentId: bot.id, key: "BOT_WALLET_SEED", value: seed });
        setWalletConnectionStatus("connected");
      }
    } catch (err) {
      setWalletConnectionStatus("error");
      setIdentityErrors((prev) => ({
        ...prev,
        wallet: err instanceof Error ? err.message : "Wallet connection failed",
      }));
    } finally {
      setWalletConnecting(false);
    }
  }, [bot.id, walletKeyVaultRef, walletProvider, walletAddress, walletChainId, walletMethods, walletSeed]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const validSecrets = secrets.filter((s) => s.name.trim() && s.key.trim());

      const harness = {
        mode: harnessMode as "cloud" | "byok" | "local" | "subprocess",
        ...(harnessMode === "byok" && {
          byok: {
            ...(byokAnthropicKey ? { anthropic: { apiKey: byokAnthropicKey } } : {}),
            ...(byokOpenAIKey ? { openai: { apiKey: byokOpenAIKey } } : {}),
            ...(byokGoogleKey ? { google: { apiKey: byokGoogleKey } } : {}),
          },
        }),
      };

      const identityChannels = {
        ...(emailAddress.trim()
          ? {
              email: {
                address: emailAddress.trim(),
                provider: emailProvider,
                sendEnabled: emailSend,
                receiveEnabled: emailReceive,
              },
            }
          : {}),
        ...(phoneNumber.trim()
          ? {
              phone: {
                number: phoneNumber.trim(),
                provider: phoneProvider,
                voiceEnabled: phoneVoice,
                smsEnabled: phoneSms,
              },
            }
          : {}),
        ...(walletAddress.trim() || walletProvider === "etrid"
          ? {
              wallet: {
                provider: walletProvider,
                ...(walletAddress.trim() ? { address: walletAddress.trim() } : {}),
                ...(walletKeyVaultRef.trim() ? { keyVaultRef: walletKeyVaultRef.trim() } : {}),
                ...(walletChainId.trim() ? { chainId: walletChainId.trim() } : {}),
                allowedMethods: walletMethods as AgentWalletPaymentMethod[],
              },
            }
          : {}),
      };

      const messagingConfig: AgentMessagingConfig = {
        photonEnabled: messagingEnabled,
        ...(messagingEndpoint.trim() ? { photonEndpoint: messagingEndpoint.trim() } : {}),
        crossSurfaceEnabled: messagingCrossSurface,
        ...(messagingSurfaces && messagingSurfaces.length > 0 ? { allowedSurfaces: messagingSurfaces } : {}),
      };

      const vmOperator = vmEnabled
        ? {
            enabled: true,
            provider: vmProvider,
            ...(vmImage.trim() ? { image: vmImage.trim() } : {}),
            resources: {
              ...(vmCpu.trim() ? { cpu: vmCpu.trim() } : {}),
              ...(vmMemory.trim() ? { memory: vmMemory.trim() } : {}),
              ...(vmDisk.trim() ? { disk: vmDisk.trim() } : {}),
            },
            allowedActions: vmActions,
            networkPolicy: vmNetworkPolicy,
            persistence: vmPersistence,
            timeoutMinutes: vmTimeout,
            vncEnabled: vmVncEnabled,
            autoStart: vmAutoStart,
          }
        : { enabled: false, provider: vmProvider };

      await updateAgent(bot.id, {
        connectorBindings: bindings,
        secretRefs: validSecrets,
        harness,
        identityChannels,
        messagingConfig,
        vmOperator,
      });

      const sealTasks: Promise<void>[] = [];
      for (const [idx, value] of Object.entries(secretValues)) {
        const secret = validSecrets[Number(idx)];
        if (secret && value.trim()) {
          sealTasks.push(sealAgentSecret({ agentId: bot.id, key: secret.key, value: value.trim() }));
        }
      }
      if (sealTasks.length > 0) {
        await Promise.all(sealTasks);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save runtime config");
    } finally {
      setSaving(false);
    }
  }, [
    bot.id,
    bindings,
    secrets,
    secretValues,
    harnessMode,
    byokAnthropicKey,
    byokOpenAIKey,
    byokGoogleKey,
    emailAddress,
    emailProvider,
    emailSend,
    emailReceive,
    phoneNumber,
    phoneProvider,
    phoneVoice,
    phoneSms,
    walletAddress,
    walletProvider,
    walletChainId,
    walletMethods,
    walletKeyVaultRef,
    messagingEnabled,
    messagingEndpoint,
    messagingCrossSurface,
    messagingSurfaces,
    onClose,
    onSaved,
  ]);

  if (!isOpen) return null;

  const sectionTabs = [
    { id: "connectors" as const, label: "Connectors", icon: Plugs },
    { id: "secrets" as const, label: "Secrets", icon: Key },
    { id: "harness" as const, label: "Harness", icon: Lightning },
    { id: "identity" as const, label: "Identity", icon: Robot },
    { id: "vm" as const, label: "Computer", icon: ComputerTower },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
              Bot Runtime Configuration
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Connectors, secrets, harness, and identity channels for {bot.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-5 shrink-0">
          {sectionTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[var(--accent-primary)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-3 text-[13px] text-[var(--status-error)]">
              {error}
            </div>
          )}

          {activeSection === "connectors" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Plugs size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Connectors</h3>
              </div>

              <ConnectorMarketplace
                bindOnConnect
                boundIds={boundIds}
                onBind={bindConnector}
                onUnbind={unbindConnector}
              />

              {bindings.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
                    Bound connectors
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {bindings.map((binding) => (
                      <span
                        key={binding.connectorId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-3 py-1 text-[12px] text-[var(--text-primary)]"
                      >
                        {binding.label || binding.provider}
                        <button
                          type="button"
                          onClick={() => removeBinding(binding.connectorId)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeSection === "secrets" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-[var(--accent-primary)]" />
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Secrets & API Keys</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSecret} className="gap-1.5">
                  <Plus size={14} />
                  Add secret
                </Button>
              </div>

              {secrets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">No secrets declared yet.</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                    Add API keys or tokens the bot needs at runtime.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {secrets.map((secret, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Label</Label>
                          <Input
                            value={secret.name}
                            onChange={(e) => updateSecret(index, { name: e.target.value })}
                            placeholder="e.g. Stripe API Key"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Env / Config Key</Label>
                          <Input
                            value={secret.key}
                            onChange={(e) => updateSecret(index, { key: e.target.value })}
                            placeholder="e.g. STRIPE_API_KEY"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Description</Label>
                        <Input
                          value={secret.description || ""}
                          onChange={(e) => updateSecret(index, { description: e.target.value })}
                          placeholder="What is this secret for?"
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">
                            Value {secret.vaultRef ? "(sealed — enter to update)" : ""}
                          </Label>
                          <Input
                            type="password"
                            value={secretValues[index] || ""}
                            onChange={(e) =>
                              setSecretValues((prev) => ({ ...prev, [index]: e.target.value }))
                            }
                            placeholder={secret.vaultRef ? "••••••" : "Leave blank to declare only"}
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-5">
                          <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={secret.required}
                              onChange={(e) => updateSecret(index, { required: e.target.checked })}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            Required to start
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSecret(index)}
                          className="gap-1.5 text-[var(--status-error)] border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/10"
                        >
                          <Trash size={14} />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "harness" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightning size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Harness</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-[12px] text-[var(--text-secondary)]">Execution Mode</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                    {(["cloud", "byok", "local", "subprocess"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setHarnessMode(mode)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          harnessMode === mode
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                            : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-hover)]"
                        )}
                      >
                        <div className="text-[13px] font-medium text-[var(--text-primary)] capitalize">
                          {mode.replace("-", " ")}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {mode === "cloud" && "Allternit-managed runners"}
                          {mode === "byok" && "Bring your own API keys"}
                          {mode === "local" && "Local runtime endpoint"}
                          {mode === "subprocess" && "Spawn a local process"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {harnessMode === "byok" && (
                  <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Provider API Keys</h4>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Anthropic API Key</Label>
                      <Input
                        type="password"
                        value={byokAnthropicKey}
                        onChange={(e) => setByokAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">OpenAI API Key</Label>
                      <Input
                        type="password"
                        value={byokOpenAIKey}
                        onChange={(e) => setByokOpenAIKey(e.target.value)}
                        placeholder="sk-..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Google API Key</Label>
                      <Input
                        type="password"
                        value={byokGoogleKey}
                        onChange={(e) => setByokGoogleKey(e.target.value)}
                        placeholder="AIza..."
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "identity" && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Robot size={18} className="text-[var(--accent-primary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Identity Channels</h3>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-4">
                Bind real accounts the bot will use autonomously. Credentials are sealed in the vault and connected through the owned-connector stack.
              </p>

              <div className="space-y-4">
                {/* Email */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Envelope size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Email</h4>
                    {emailConnectionStatus === "connected" && (
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                      <Input
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="bot@yourdomain.com"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    {listIdentityConnectors(ownedConnectors, "email").filter((c) => c.connection?.status === "connected").length > 0 && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Use connected email connector</Label>
                        <select
                          value=""
                          onChange={(e) => {
                            const connector = ownedConnectors.find((c) => c.id === e.target.value);
                            if (connector) bindConnector(connector);
                          }}
                          className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
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
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={emailProvider}
                        onChange={(e) => {
                          setEmailProvider(e.target.value as AgentEmailChannel["provider"]);
                          setEmailConnectionStatus("idle");
                        }}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="commrails">CommRails</option>
                        <option value="google_workspace">Gmail / Google Workspace</option>
                        <option value="microsoft_365">Outlook / Microsoft 365</option>
                        <option value="agent_mail">AgentMail (API key)</option>
                        <option value="generic_imap">Generic IMAP/SMTP</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailSend}
                          onChange={(e) => setEmailSend(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Send
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailReceive}
                          onChange={(e) => setEmailReceive(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Receive
                      </label>
                    </div>
                    {emailProvider === "agent_mail" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">AgentMail API key</Label>
                        <Input
                          type="password"
                          value={emailApiKey}
                          onChange={(e) => setEmailApiKey(e.target.value)}
                          placeholder="am_..."
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                    {(emailProvider === "generic_imap" || emailProvider === "custom" || emailProvider === "commrails") && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Password</Label>
                        <Input
                          type="password"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          placeholder="The bot needs this to sign in to the mailbox."
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                    {emailProvider === "generic_imap" && (
                      <>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">IMAP host</Label>
                          <Input
                            value={emailImapHost}
                            onChange={(e) => setEmailImapHost(e.target.value)}
                            placeholder="imap.example.com"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">IMAP port</Label>
                          <Input
                            value={emailImapPort}
                            onChange={(e) => setEmailImapPort(e.target.value)}
                            placeholder="993"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">SMTP host</Label>
                          <Input
                            value={emailSmtpHost}
                            onChange={(e) => setEmailSmtpHost(e.target.value)}
                            placeholder="smtp.example.com"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">SMTP port</Label>
                          <Input
                            value={emailSmtpPort}
                            onChange={(e) => setEmailSmtpPort(e.target.value)}
                            placeholder="587"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[12px] text-[var(--text-tertiary)]">
                      {emailAddress.trim()
                        ? "Click Connect to bind this mailbox and seal its credentials."
                        : "Enter the bot's email address, then connect it."}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleConnectEmail()}
                      disabled={emailConnecting || !emailAddress.trim()}
                      className="gap-1.5 shrink-0"
                    >
                      {emailConnecting ? "Connecting…" : "Connect email"}
                    </Button>
                  </div>
                  {identityErrors.email && (
                    <div className="mt-2 text-[12px] text-[var(--status-error)]">{identityErrors.email}</div>
                  )}
                </div>

                {/* Phone */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Phone</h4>
                    {phoneConnectionStatus === "connected" && (
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Number</Label>
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    {listIdentityConnectors(ownedConnectors, "phone").filter((c) => c.connection?.status === "connected").length > 0 && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Use connected phone connector</Label>
                        <select
                          value=""
                          onChange={(e) => {
                            const connector = ownedConnectors.find((c) => c.id === e.target.value);
                            if (connector) bindConnector(connector);
                          }}
                          className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
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
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={phoneProvider}
                        onChange={(e) => {
                          setPhoneProvider(e.target.value as AgentPhoneChannel["provider"]);
                          setPhoneConnectionStatus("idle");
                        }}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="vapi">Vapi</option>
                        <option value="twilio">Twilio</option>
                        <option value="telnyx">Telnyx</option>
                        <option value="android_bridge">Android Bridge (real device)</option>
                        <option value="photon">Photon.codes</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phoneVoice}
                          onChange={(e) => setPhoneVoice(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        Voice
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phoneSms}
                          onChange={(e) => setPhoneSms(e.target.checked)}
                          className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                        />
                        SMS
                      </label>
                    </div>
                    {phoneProvider === "twilio" && (
                      <>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Twilio Account SID</Label>
                          <Input
                            value={phoneTwilioSid}
                            onChange={(e) => setPhoneTwilioSid(e.target.value)}
                            placeholder="AC..."
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Twilio Auth Token</Label>
                          <Input
                            type="password"
                            value={phoneTwilioToken}
                            onChange={(e) => setPhoneTwilioToken(e.target.value)}
                            placeholder="your_auth_token"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </>
                    )}
                    {phoneProvider === "telnyx" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Telnyx API key</Label>
                        <Input
                          type="password"
                          value={phoneTelnyxKey}
                          onChange={(e) => setPhoneTelnyxKey(e.target.value)}
                          placeholder="KEY..."
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                    {phoneProvider === "android_bridge" && (
                      <>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Android Bridge base URL</Label>
                          <Input
                            value={phoneAndroidBaseUrl}
                            onChange={(e) => setPhoneAndroidBaseUrl(e.target.value)}
                            placeholder="http://127.0.0.1:8020"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Paired Android device ID</Label>
                          <Input
                            value={phoneAndroidDeviceId}
                            onChange={(e) => setPhoneAndroidDeviceId(e.target.value)}
                            placeholder="device-uuid-or-serial"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                      </>
                    )}
                    {phoneProvider === "photon" && (
                      <>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Photon Project ID</Label>
                          <Input
                            value={phonePhotonProjectId}
                            onChange={(e) => setPhonePhotonProjectId(e.target.value)}
                            placeholder="proj_..."
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Photon Project Secret</Label>
                          <Input
                            type="password"
                            value={phonePhotonProjectSecret}
                            onChange={(e) => setPhonePhotonProjectSecret(e.target.value)}
                            placeholder="your_project_secret"
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-[12px] text-[var(--text-secondary)]">
                            Line ID <span className="text-[var(--text-tertiary)]">(optional)</span>
                          </Label>
                          <Input
                            value={phonePhotonLineId}
                            onChange={(e) => setPhonePhotonLineId(e.target.value)}
                            placeholder="line_..."
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="sm:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                          <p className="text-[12px] font-medium text-[var(--text-primary)] mb-1">Photon.codes free tier</p>
                          <ul className="text-[12px] text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                            <li>Shared iMessage line on the free tier</li>
                            <li>Rate limits apply</li>
                            <li>Dedicated lines require an upgrade</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[12px] text-[var(--text-tertiary)]">
                      {phoneNumber.trim()
                        ? "Click Connect to bind this number and seal its credentials."
                        : "Enter the bot's phone number, then connect it."}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleConnectPhone()}
                      disabled={phoneConnecting || !phoneNumber.trim()}
                      className="gap-1.5 shrink-0"
                    >
                      {phoneConnecting ? "Connecting…" : "Connect phone"}
                    </Button>
                  </div>
                  {identityErrors.phone && (
                    <div className="mt-2 text-[12px] text-[var(--status-error)]">{identityErrors.phone}</div>
                  )}
                </div>

                {/* Wallet */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Wallet</h4>
                    {walletConnectionStatus === "connected" && (
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={walletProvider}
                        onChange={(e) => {
                          setWalletProvider(e.target.value as AgentWalletChannel["provider"]);
                          setWalletConnectionStatus("idle");
                        }}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="etrid">Etrid (native)</option>
                        <option value="metamask">MetaMask</option>
                        <option value="coinbase_wallet">Coinbase Wallet</option>
                        <option value="rainbow">Rainbow</option>
                        <option value="phantom">Phantom</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Chain ID</Label>
                      <Input
                        value={walletChainId}
                        onChange={(e) => setWalletChainId(e.target.value)}
                        placeholder="e.g. 1, 8453, solana"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Address</Label>
                      <Input
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder={walletProvider === "etrid" ? "Enter the Etrid address" : "0x... or address"}
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    {walletProvider !== "etrid" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[12px] text-[var(--text-secondary)]">Seed / private key</Label>
                        <Input
                          type="password"
                          value={walletSeed}
                          onChange={(e) => setWalletSeed(e.target.value)}
                          placeholder="Sealed in the vault; used by the bot to sign transactions."
                          className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                    {walletProvider === "etrid" && (
                      <div className="sm:col-span-2 text-[12px] text-[var(--text-tertiary)]">
                        Etrid wallets are managed natively. Enter the address above; the private key stays in the Etrid vault.
                      </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Allowed Methods</Label>
                      <div className="flex flex-wrap gap-3">
                        {(["send", "receive", "swap", "stake", "invoice"] as const).map((method) => (
                          <label key={method} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={walletMethods.includes(method)}
                              onChange={() => toggleWalletMethod(method)}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            <span className="capitalize">{method}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleConnectWallet()}
                      disabled={walletConnecting || (walletProvider !== "etrid" && !walletAddress.trim())}
                      className="gap-1.5 shrink-0"
                    >
                      {walletConnecting
                        ? walletProvider === "etrid" && !walletAddress.trim()
                          ? "Creating…"
                          : "Connecting…"
                        : walletProvider === "etrid" && !walletAddress.trim()
                          ? "Create Etrid wallet"
                          : "Connect wallet"}
                    </Button>
                  </div>
                  {identityErrors.wallet && (
                    <div className="mt-2 text-[12px] text-[var(--status-error)]">{identityErrors.wallet}</div>
                  )}
                </div>

                {/* Photon / Cloud Messaging */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cloud size={16} className="text-[var(--accent-primary)]" />
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">Photon Cloud Messaging</h4>
                    {messagingEnabled && (
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)]">Enabled</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mb-3">
                    Native orchestration bus for cross-surface sessions and cloud handoffs.
                  </p>
                  <div className="space-y-3 mb-3">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={messagingEnabled}
                        onChange={(e) => setMessagingEnabled(e.target.checked)}
                        className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                      />
                      Enable Photon orchestration
                    </label>
                    {messagingEnabled && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-[var(--text-secondary)]">Photon endpoint / topic</Label>
                          <Input
                            value={messagingEndpoint}
                            onChange={(e) => setMessagingEndpoint(e.target.value)}
                            placeholder="photon://agents/{bot-id} or wss://photon.allternit.com/..."
                            className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={messagingCrossSurface}
                            onChange={(e) => setMessagingCrossSurface(e.target.checked)}
                            className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                          />
                          Cross-surface sessions
                        </label>
                        <div>
                          <Label className="text-[12px] text-[var(--text-secondary)] mb-2 block">Allowed surfaces</Label>
                          <div className="flex flex-wrap gap-3">
                            {([
                              { id: "chat" as const, label: "Chat" },
                              { id: "cowork" as const, label: "CoWork" },
                              { id: "code" as const, label: "Code" },
                              { id: "design" as const, label: "Design" },
                              { id: "browser" as const, label: "Browser" },
                            ]).map((surface) => (
                              <label key={surface.id} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(messagingSurfaces ?? []).includes(surface.id)}
                                  onChange={(e) => {
                                    setMessagingSurfaces((prev) => {
                                      const current = prev ?? [];
                                      return e.target.checked
                                        ? [...current, surface.id]
                                        : current.filter((s) => s !== surface.id);
                                    });
                                  }}
                                  className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
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
          )}

          {activeSection === "vm" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ComputerTower size={18} className="text-[var(--accent-primary)]" />
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Virtual Computer</h3>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vmEnabled}
                    onChange={(e) => setVMEnabled(e.target.checked)}
                    className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                  />
                  Enabled
                </label>
              </div>

              {vmEnabled ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Provider</Label>
                      <select
                        value={vmProvider}
                        onChange={(e) => setVMProvider(e.target.value as AgentVMProvider)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="opensandbox">OpenSandbox</option>
                        <option value="docker">Docker</option>
                        <option value="kubernetes">Kubernetes</option>
                        <option value="local">Local Runner</option>
                        <option value="custom">Custom Provider</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Image</Label>
                      <Input
                        value={vmImage}
                        onChange={(e) => setVMImage(e.target.value)}
                        placeholder="opensandbox/desktop:v1.0.0"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[12px] text-[var(--text-secondary)] mb-2 block">Allowed Actions</Label>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { id: "command" as const, label: "Shell commands", icon: Terminal },
                        { id: "browser" as const, label: "Browser", icon: Globe },
                        { id: "file" as const, label: "Files", icon: FileCode },
                        { id: "desktop" as const, label: "Desktop / VNC", icon: Desktop },
                        { id: "code" as const, label: "Code execution", icon: SquaresFour },
                      ]).map((action) => {
                        const Icon = action.icon;
                        return (
                          <label
                            key={action.id}
                            className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={vmActions.includes(action.id)}
                              onChange={(e) => {
                                setVMActions((prev) =>
                                  e.target.checked ? [...prev, action.id] : prev.filter((a) => a !== action.id)
                                );
                              }}
                              className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                            />
                            <Icon size={14} className="text-[var(--text-secondary)]" />
                            {action.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">CPU</Label>
                      <Input
                        value={vmCpu}
                        onChange={(e) => setVMCpu(e.target.value)}
                        placeholder="1"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Memory</Label>
                      <Input
                        value={vmMemory}
                        onChange={(e) => setVMMemory(e.target.value)}
                        placeholder="2Gi"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Disk</Label>
                      <Input
                        value={vmDisk}
                        onChange={(e) => setVMDisk(e.target.value)}
                        placeholder="10Gi"
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Network Policy</Label>
                      <select
                        value={vmNetworkPolicy}
                        onChange={(e) => setVMNetworkPolicy(e.target.value as AgentVMNetworkPolicy)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="isolated">Isolated</option>
                        <option value="restricted">Restricted</option>
                        <option value="open">Open</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Persistence</Label>
                      <select
                        value={vmPersistence}
                        onChange={(e) => setVMPersistence(e.target.value as AgentVMPersistence)}
                        className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[13px] px-2"
                      >
                        <option value="ephemeral">Ephemeral</option>
                        <option value="session">Session</option>
                        <option value="persistent">Persistent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Timeout (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={vmTimeout}
                        onChange={(e) => setVMTimeout(Number(e.target.value))}
                        className="h-9 bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer self-end pb-2">
                      <input
                        type="checkbox"
                        checked={vmVncEnabled}
                        onChange={(e) => setVMVncEnabled(e.target.checked)}
                        className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                      />
                      VNC stream
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] cursor-pointer self-end pb-2">
                      <input
                        type="checkbox"
                        checked={vmAutoStart}
                        onChange={(e) => setVMAutoStart(e.target.checked)}
                        className="rounded border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
                      />
                      Auto-start on task
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">Virtual computer is disabled.</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                    Enable it to let this bot run tasks inside a sandbox.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border-subtle)] shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
            style={{ background: "var(--accent-primary)", color: "#fff" }}
          >
            {saving ? "Saving…" : "Save runtime config"}
          </Button>
        </div>
      </div>
    </div>
  );
}
