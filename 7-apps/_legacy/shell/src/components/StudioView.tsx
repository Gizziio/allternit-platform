import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  getDefaultVoiceId,
  getVoicePersonas,
  saveVoicePersonas,
  syncVoicePersonasFromService,
  VOICE_PERSONAS_EVENT,
  VOICE_PERSONAS_STORAGE_KEY,
} from '../config/voicePersonas';
import { api } from '../runtime/ApiClient';
import { voiceService } from '../runtime/VoiceService';
import {
  loadVault,
  saveVault,
  generateVaultEntry,
  unlockVaultEntry,
  signSkillPayload,
  signAgentPayload,
  VaultEntry,
} from '../runtime/publisherVault';
import {
  AgentSpec,
  ArtifactMetadata,
  KernelJournalEvent,
  PublisherKey,
  TemplateIndex,
  ToolDefinition,
  ToolExecutionResult,
  ToolGatewayDefinition,
  ToolType,
  SafetyTier,
  Skill,
  WorkflowDefinition,
  WorkflowExecution,
} from '../../shared/contracts';

const TRAIT_OPTIONS = [
  'Analytical',
  'Curious',
  'Empathetic',
  'Direct',
  'Creative',
  'Skeptical',
  'Patient',
  'Precise',
  'Strategic',
  'Pragmatic',
  'Visionary',
  'Diplomatic',
  'Bold',
  'Cautious',
  'Collaborative',
  'Independent',
  'Optimistic',
  'Critical',
  'Playful',
  'Calm',
  'Meticulous',
  'Resourceful',
  'Systems-Thinking',
  'User-Centered',
  'Data-Driven',
  'Ethical',
  'Adaptable',
  'Decisive',
  'Methodical',
  'Supportive',
];
const DOMAIN_OPTIONS = [
  'Frontend',
  'Backend',
  'Fullstack',
  'Mobile',
  'DevOps',
  'SRE',
  'Platform',
  'Infrastructure',
  'Data Engineering',
  'ML/AI',
  'Security',
  'Privacy/Compliance',
  'Observability',
  'Product',
  'UX/UI Design',
  'QA',
  'Research',
  'Growth',
  'Developer Experience',
  'Cloud Architecture',
];
const APPROACH_OPTIONS = [
  'Systematic',
  'Exploratory',
  'Rapid',
  'Critical',
  'Supportive',
  'Socratic',
  'Hypothesis-Driven',
  'Risk-First',
  'Design-First',
  'User-First',
  'Data-Led',
  'Experiment-Driven',
  'Iterative',
  'Strategic',
  'Tactical',
  'Lean',
  'Reflective',
];
const SKILL_OPTIONS = ['Code Review', 'Debugging', 'Documentation', 'Testing', 'Refactoring', 'Architecture', 'UI Polish'];
const VOICE_INTENTS = [
  'Neutral',
  'Curious',
  'Calm',
  'Assertive',
  'Playful',
  'Reflective',
  'Warm',
  'Analytical',
  'Energetic',
  'Steady',
  'Professional',
  'Mentor',
];
const TRAIT_TO_INTENT: Record<string, string> = {
  Analytical: 'Analytical',
  Curious: 'Curious',
  Empathetic: 'Warm',
  Direct: 'Assertive',
  Creative: 'Playful',
  Skeptical: 'Reflective',
  Patient: 'Calm',
  Precise: 'Analytical',
  Strategic: 'Professional',
  Pragmatic: 'Steady',
  Visionary: 'Energetic',
  Diplomatic: 'Warm',
  Bold: 'Assertive',
  Cautious: 'Steady',
  Collaborative: 'Warm',
  Independent: 'Neutral',
  Optimistic: 'Energetic',
  Critical: 'Reflective',
  Playful: 'Playful',
  Calm: 'Calm',
  Meticulous: 'Analytical',
  Resourceful: 'Steady',
  'Systems-Thinking': 'Analytical',
  'User-Centered': 'Warm',
  'Data-Driven': 'Analytical',
  Ethical: 'Steady',
  Adaptable: 'Energetic',
  Decisive: 'Assertive',
  Methodical: 'Steady',
  Supportive: 'Warm',
};

const DEFAULT_SKILL_TEMPLATE = {
  manifest: {
    id: 'example.skill',
    name: 'Example Skill',
    version: '0.1.0',
    description: 'Describe what this skill does.',
    author: 'You',
    license: 'MIT',
    tags: [],
    homepage: null,
    repository: null,
    inputs: {
      schema: '{"type":"object","properties":{"input":{"type":"string"}}}',
      examples: [{ input: 'example' }],
    },
    outputs: {
      schema: '{"type":"object","properties":{"output":{"type":"string"}}}',
      examples: [{ output: 'result' }],
    },
    runtime: {
      mode: 'Sandbox',
      timeouts: {
        per_step: 30,
        total: 120,
      },
      resources: {
        cpu: '250m',
        gpu: null,
        memory: '256Mi',
      },
    },
    environment: {
      allowed_envs: ['Dev'],
      network: 'None',
      filesystem: 'None',
    },
    side_effects: ['read'],
    risk_tier: 'T0',
    required_permissions: ['perm_t0_read'],
    requires_policy_gate: true,
    publisher: {
      publisher_id: 'your.publisher',
      public_key_id: 'key1',
    },
    signature: {
      manifest_sig: '',
      bundle_hash: '',
    },
  },
  workflow: {
    nodes: [
      {
        id: 'observe',
        name: 'Observe',
        phase: 'Observe',
        tool_binding: 'echo_tool',
        inputs: ['input'],
        outputs: ['output'],
      },
    ],
    edges: [],
    per_node_constraints: {},
    artifact_outputs: [],
  },
  tools: [
    {
      id: 'echo_tool',
      name: 'Echo Tool',
      description: 'Example local tool.',
      tool_type: 'Local',
      command: 'echo',
      endpoint: '',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      output_schema: {
        type: 'object',
        properties: {
          output: { type: 'string' },
        },
      },
      side_effects: ['read'],
      idempotency_behavior: 'idempotent',
      retryable: true,
      failure_classification: 'transient',
      safety_tier: 'T0',
      resource_limits: {
        cpu: '100m',
        memory: '64Mi',
        network: 'None',
        filesystem: 'None',
        time_limit: 10,
      },
    },
  ],
  human_routing: 'Explain when to use this skill and any hazards.',
};

const DEFAULT_SKILL_DRAFT = JSON.stringify(DEFAULT_SKILL_TEMPLATE, null, 2);

export const StudioView: React.FC = () => {
  const [activeSpace, setActiveSpace] = useState<'builders' | 'pipelines' | 'artifacts' | 'templates'>('builders');
  const [activeBuilder, setActiveBuilder] = useState<'agent' | 'workflow' | 'tool' | 'skill'>('agent');
  const [activePipeline, setActivePipeline] = useState<'comfyui'>('comfyui');
  const [voicePersonas, setVoicePersonas] = useState(getVoicePersonas());
  const [personaDraft, setPersonaDraft] = useState({ id: '', label: '', referenceAudioUrl: '', sampleName: '' });
  const [personaError, setPersonaError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'draft' | string>('draft');
  const [agentName, setAgentName] = useState('');
  const [personaNotes, setPersonaNotes] = useState('');
  const [operatingMode, setOperatingMode] = useState('fast');
  const [agentVoice, setAgentVoice] = useState(getDefaultVoiceId(voicePersonas));
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const [traits, setTraits] = useState<string[]>([]);
  const [traitDraft, setTraitDraft] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [domainDraft, setDomainDraft] = useState('');
  const [approachStyle, setApproachStyle] = useState(APPROACH_OPTIONS[0]);
  const [contextSkills, setContextSkills] = useState<string[]>([]);
  const [contextSkillDraft, setContextSkillDraft] = useState('');
  const [voiceIntent, setVoiceIntent] = useState(VOICE_INTENTS[0]);
  const [previewText, setPreviewText] = useState('Hello, I am {name}. Ready to help.');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [agentTemplates, setAgentTemplates] = useState<AgentSpec[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [publisherKeys, setPublisherKeys] = useState<PublisherKey[]>([]);
  const [publisherEvents, setPublisherEvents] = useState<KernelJournalEvent[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [workflowExecution, setWorkflowExecution] = useState<WorkflowExecution | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactMetadata[]>([]);
  const [templatesIndex, setTemplatesIndex] = useState<TemplateIndex | null>(null);
  const [studioError, setStudioError] = useState('');
  const [studioNotice, setStudioNotice] = useState('');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [publisherKeysLoading, setPublisherKeysLoading] = useState(false);
  const [publisherEventsLoading, setPublisherEventsLoading] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [agentSaveStatus, setAgentSaveStatus] = useState('');
  const [toolSaveStatus, setToolSaveStatus] = useState('');
  const [toolTestStatus, setToolTestStatus] = useState('');
  const [toolFormError, setToolFormError] = useState('');
  const [toolTestResult, setToolTestResult] = useState<ToolExecutionResult | null>(null);
  const [workflowFormError, setWorkflowFormError] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState('');
  const [agentPublisherId, setAgentPublisherId] = useState('');
  const [agentPublicKeyId, setAgentPublicKeyId] = useState('');
  const [agentSignature, setAgentSignature] = useState('');
  const [agentBundleHash, setAgentBundleHash] = useState('');
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultActiveId, setVaultActiveId] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [vaultStatus, setVaultStatus] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const vaultSecretRef = useRef<Uint8Array | null>(null);
  const [publisherKeyStatus, setPublisherKeyStatus] = useState('');
  const [publisherKeyError, setPublisherKeyError] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [publisherPublicKeyId, setPublisherPublicKeyId] = useState('');
  const [publisherPublicKey, setPublisherPublicKey] = useState('');
  const [skillDraft, setSkillDraft] = useState(DEFAULT_SKILL_DRAFT);
  const [skillSaveStatus, setSkillSaveStatus] = useState('');
  const [skillSaveError, setSkillSaveError] = useState('');
  const [toolId, setToolId] = useState('');
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolType, setToolType] = useState<ToolType>('Local');
  const [toolCommand, setToolCommand] = useState('');
  const [toolEndpoint, setToolEndpoint] = useState('');
  const [toolInputSchema, setToolInputSchema] = useState('{"type":"object","properties":{}}');
  const [toolOutputSchema, setToolOutputSchema] = useState('{"type":"object"}');
  const [toolTestInput, setToolTestInput] = useState('{}');
  const [toolSafetyTier, setToolSafetyTier] = useState<SafetyTier>('T1');
  const [workflowDraft, setWorkflowDraft] = useState('{\n  \"workflow_id\": \"\",\n  \"version\": \"0.1.0\",\n  \"description\": \"\",\n  \"required_roles\": [],\n  \"allowed_skill_tiers\": [\"T1\"],\n  \"phases_used\": [\"Plan\", \"Execute\"],\n  \"success_criteria\": \"\",\n  \"failure_modes\": [],\n  \"nodes\": [],\n  \"edges\": []\n}');
  const [workflowInput, setWorkflowInput] = useState('{}');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');

  useEffect(() => {
    if (!voicePersonas.find((persona) => persona.id === agentVoice)) {
      setAgentVoice(getDefaultVoiceId(voicePersonas));
    }
  }, [voicePersonas, agentVoice]);

  useEffect(() => {
    const handleUpdate = () => setVoicePersonas(getVoicePersonas());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === VOICE_PERSONAS_STORAGE_KEY) {
        handleUpdate();
      }
    };
    window.addEventListener(VOICE_PERSONAS_EVENT, handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    const controller = new AbortController();
    void syncVoicePersonasFromService(controller.signal);
    return () => {
      window.removeEventListener(VOICE_PERSONAS_EVENT, handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const vault = loadVault();
    setVaultEntries(vault.entries);
    if (vault.activeKeyId) {
      setVaultActiveId(vault.activeKeyId);
    }
  }, []);

  useEffect(() => {
    const activeEntry = resolveActiveVaultEntry();
    if (activeEntry) {
      setAgentPublisherId(activeEntry.publisherId);
      setAgentPublicKeyId(activeEntry.publicKeyId);
      setPublisherId(activeEntry.publisherId);
      setPublisherPublicKeyId(activeEntry.publicKeyId);
      setPublisherPublicKey(activeEntry.publicKey);
    }
  }, [vaultActiveId, vaultEntries]);

  useEffect(() => {
    vaultSecretRef.current = null;
    setVaultUnlocked(false);
  }, [vaultActiveId]);

  const normalizeError = (err: unknown) => (
    err instanceof Error ? err.message : 'Unexpected error'
  );

  const loadAgentTemplates = async () => {
    setAgentsLoading(true);
    setStudioError('');
    try {
      const templates = await api.listAgentTemplates();
      setAgentTemplates(templates);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setAgentsLoading(false);
    }
  };

  const loadTools = async () => {
    setToolsLoading(true);
    setStudioError('');
    try {
      const list = await api.listTools();
      setTools(list);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setToolsLoading(false);
    }
  };

  const loadSkills = async () => {
    setSkillsLoading(true);
    setStudioError('');
    try {
      const list = await api.listSkillsRegistry();
      setSkills(list);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadPublisherKeys = async () => {
    setPublisherKeysLoading(true);
    setStudioError('');
    try {
      const list = await api.listPublisherKeys();
      setPublisherKeys(list);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setPublisherKeysLoading(false);
    }
  };

  const loadPublisherEvents = async () => {
    setPublisherEventsLoading(true);
    setStudioError('');
    try {
      const events = await api.listJournalEvents();
      const filtered = events.filter((event) => (
        event.kind.startsWith('publisher_')
        || event.kind.startsWith('skill_')
        || event.kind.startsWith('agent_template_')
      ));
      const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
      setPublisherEvents(sorted);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setPublisherEventsLoading(false);
    }
  };

  const loadWorkflows = async () => {
    setWorkflowsLoading(true);
    setStudioError('');
    try {
      const list = await api.listWorkflows();
      setWorkflows(list);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const loadArtifacts = async () => {
    setArtifactsLoading(true);
    setStudioError('');
    try {
      const response = await api.listArtifacts(24, 0);
      setArtifacts(response.artifacts || []);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setArtifactsLoading(false);
    }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    setStudioError('');
    try {
      const index = await api.listTemplatesIndex();
      setTemplatesIndex(index);
    } catch (err) {
      setStudioError(normalizeError(err));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const persistVault = (entries: VaultEntry[], activeKeyId?: string) => {
    setVaultEntries(entries);
    setVaultActiveId(activeKeyId || '');
    saveVault({
      entries,
      activeKeyId: activeKeyId || undefined,
    });
  };

  const resolveActiveVaultEntry = () => (
    vaultEntries.find((entry) => entry.id === vaultActiveId) || null
  );

  const publisherKeyIndex = React.useMemo(() => {
    const active = new Set<string>();
    const revoked = new Set<string>();
    publisherKeys.forEach((key) => {
      const id = `${key.publisher_id}:${key.public_key_id}`;
      if (key.revoked) {
        revoked.add(id);
      } else {
        active.add(id);
      }
    });
    return { active, revoked };
  }, [publisherKeys]);

  const mergePublisherKeys = (entries: PublisherKey[]) => {
    if (entries.length === 0) return;
    setPublisherKeys((prev) => {
      const map = new Map(prev.map((key) => [`${key.publisher_id}:${key.public_key_id}`, key]));
      entries.forEach((key) => {
        map.set(`${key.publisher_id}:${key.public_key_id}`, key);
      });
      return Array.from(map.values());
    });
  };

  const registerPublisherKey = async (payload: {
    publisher_id: string;
    public_key_id: string;
    public_key: string;
  }): Promise<{ key: PublisherKey; existed: boolean }> => {
    const existing = await api.listPublisherKeys(payload.publisher_id);
    mergePublisherKeys(existing);
    const match = existing.find((key) => key.public_key_id === payload.public_key_id);
    if (match) {
      if (match.public_key !== payload.public_key) {
        throw new Error('Publisher key id is already registered with a different public key.');
      }
      if (match.revoked) {
        throw new Error('Publisher key is revoked. Generate a new key.');
      }
      return { key: match, existed: true };
    }
    const registered = await api.registerPublisherKey(payload);
    mergePublisherKeys([registered]);
    return { key: registered, existed: false };
  };

  const ensureVaultSecret = async () => {
    const activeEntry = resolveActiveVaultEntry();
    if (!activeEntry) {
      throw new Error('Select a publisher identity in the local vault.');
    }
    if (vaultSecretRef.current) {
      return vaultSecretRef.current;
    }
    if (!vaultPassphrase.trim()) {
      throw new Error('Enter your vault passphrase to unlock signing.');
    }
    const secret = await unlockVaultEntry(activeEntry, vaultPassphrase.trim());
    vaultSecretRef.current = secret;
    setVaultUnlocked(true);
    return secret;
  };

  const buildFallbackId = (prefix: string) => {
    const seed = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const compact = seed.replace(/-/g, '').slice(0, 8);
    return `${prefix}-${compact}`;
  };

  const handleGenerateVaultKey = async () => {
    setVaultError('');
    setVaultStatus('');
    setPublisherKeyError('');
    setPublisherKeyStatus('');
    let resolvedPublisherId = publisherId.trim();
    let resolvedKeyId = publisherPublicKeyId.trim();
    if (!resolvedPublisherId) {
      resolvedPublisherId = `local.publisher.${buildFallbackId('pub')}`;
      setPublisherId(resolvedPublisherId);
    }
    if (!resolvedKeyId) {
      resolvedKeyId = buildFallbackId('key');
      setPublisherPublicKeyId(resolvedKeyId);
    }
    if (!vaultPassphrase.trim()) {
      setVaultError('Passphrase is required to encrypt the vault.');
      return;
    }
    try {
      const result = await generateVaultEntry(
        resolvedPublisherId,
        resolvedKeyId,
        vaultPassphrase.trim()
      );
      const nextEntries = vaultEntries
        .filter((entry) => entry.id !== result.entry.id)
        .concat(result.entry);
      persistVault(nextEntries, result.entry.id);
      vaultSecretRef.current = result.secretKey;
      setVaultUnlocked(true);
      setPublisherPublicKey(result.entry.publicKey);
      try {
        const { key, existed } = await registerPublisherKey({
          publisher_id: result.entry.publisherId,
          public_key_id: result.entry.publicKeyId,
          public_key: result.entry.publicKey,
        });
        setPublisherKeyStatus(
          existed
            ? `Publisher key already registered: ${key.publisher_id}:${key.public_key_id}.`
            : `Registered ${key.publisher_id}:${key.public_key_id}.`
        );
        await loadPublisherEvents();
      } catch (err) {
        setPublisherKeyError(normalizeError(err));
      }
      setVaultStatus(`Generated key for ${result.entry.publisherId}.`);
    } catch (err) {
      setVaultError(normalizeError(err));
    }
  };

  const handleUnlockVault = async () => {
    setVaultError('');
    setVaultStatus('');
    try {
      await ensureVaultSecret();
      setVaultStatus('Vault unlocked for this session.');
    } catch (err) {
      setVaultError(normalizeError(err));
    }
  };

  const handleLockVault = () => {
    vaultSecretRef.current = null;
    setVaultUnlocked(false);
    setVaultStatus('Vault locked.');
  };

  const handleActivateVaultEntry = (entry: VaultEntry) => {
    persistVault(vaultEntries, entry.id);
    setPublisherId(entry.publisherId);
    setPublisherPublicKeyId(entry.publicKeyId);
    setPublisherPublicKey(entry.publicKey);
  };

  const handleRegisterPublisherKey = async () => {
    setPublisherKeyError('');
    setPublisherKeyStatus('');
    if (!publisherId.trim() || !publisherPublicKeyId.trim() || !publisherPublicKey.trim()) {
      setPublisherKeyError('Publisher id, key id, and public key are required.');
      return;
    }
    try {
      const { key, existed } = await registerPublisherKey({
        publisher_id: publisherId.trim(),
        public_key_id: publisherPublicKeyId.trim(),
        public_key: publisherPublicKey.trim(),
      });
      setPublisherKeyStatus(
        existed
          ? `Publisher key already registered: ${key.publisher_id}:${key.public_key_id}.`
          : `Registered ${key.publisher_id}:${key.public_key_id}.`
      );
      setPublisherPublicKey('');
      await loadPublisherEvents();
    } catch (err) {
      setPublisherKeyError(normalizeError(err));
    }
  };

  const handleRegisterVaultEntry = async (entry: VaultEntry) => {
    setPublisherKeyError('');
    setPublisherKeyStatus('');
    try {
      const { key, existed } = await registerPublisherKey({
        publisher_id: entry.publisherId,
        public_key_id: entry.publicKeyId,
        public_key: entry.publicKey,
      });
      setPublisherKeyStatus(
        existed
          ? `Publisher key already registered: ${key.publisher_id}:${key.public_key_id}.`
          : `Registered ${key.publisher_id}:${key.public_key_id}.`
      );
      await loadPublisherEvents();
    } catch (err) {
      setPublisherKeyError(normalizeError(err));
    }
  };

  const handleRevokePublisherKey = async (key: PublisherKey) => {
    setPublisherKeyError('');
    setPublisherKeyStatus('');
    try {
      await api.revokePublisherKey(key.publisher_id, { public_key_id: key.public_key_id });
      setPublisherKeyStatus(`Revoked ${key.publisher_id}:${key.public_key_id}.`);
      await loadPublisherKeys();
      await loadPublisherEvents();
    } catch (err) {
      setPublisherKeyError(normalizeError(err));
    }
  };

  const handleSaveSkill = async () => {
    setSkillSaveError('');
    setSkillSaveStatus('');
    let parsed: Skill;
    try {
      parsed = JSON.parse(skillDraft) as Skill;
    } catch (err) {
      setSkillSaveError('Skill JSON is invalid.');
      return;
    }
    try {
      const activeEntry = resolveActiveVaultEntry();
      if (!activeEntry) {
        throw new Error('Select a publisher identity to sign the skill.');
      }
      const secret = await ensureVaultSecret();
      const { key, existed } = await registerPublisherKey({
        publisher_id: activeEntry.publisherId,
        public_key_id: activeEntry.publicKeyId,
        public_key: activeEntry.publicKey,
      });
      if (!existed) {
        setPublisherKeyStatus(`Registered ${key.publisher_id}:${key.public_key_id}.`);
      }
      parsed.manifest.publisher = {
        publisher_id: activeEntry.publisherId,
        public_key_id: activeEntry.publicKeyId,
      };
      const signature = await signSkillPayload(parsed as unknown as Record<string, unknown>, secret);
      parsed.manifest.signature = signature;
      setSkillDraft(JSON.stringify(parsed, null, 2));
      const response = await api.createSkill(parsed);
      setSkillSaveStatus(`Registered ${response.id}.`);
      await loadSkills();
      await loadPublisherEvents();
    } catch (err) {
      setSkillSaveError(normalizeError(err));
    }
  };

  const handleResetSkillDraft = () => {
    setSkillDraft(DEFAULT_SKILL_DRAFT);
    setSkillSaveError('');
    setSkillSaveStatus('');
  };

  useEffect(() => {
    if (activeSpace === 'builders') {
      if (activeBuilder === 'agent') {
        loadAgentTemplates();
      } else if (activeBuilder === 'tool') {
        loadTools();
      } else if (activeBuilder === 'skill') {
        loadSkills();
        loadPublisherKeys();
        loadPublisherEvents();
      } else if (activeBuilder === 'workflow') {
        loadWorkflows();
      }
    }
    if (activeSpace === 'artifacts') {
      loadArtifacts();
    }
    if (activeSpace === 'templates') {
      loadTemplates();
    }
  }, [activeSpace, activeBuilder]);

  const handleAddPersona = () => {
    const id = personaDraft.id.trim();
    if (!id) {
      setPersonaError('Voice id is required.');
      return;
    }
    const label = (personaDraft.label || id).trim();
    const next = voicePersonas.filter((persona) => persona.id !== id).concat({
      id,
      label,
      ...(personaDraft.referenceAudioUrl ? { referenceAudioUrl: personaDraft.referenceAudioUrl } : {}),
      ...(personaDraft.sampleName ? { sampleName: personaDraft.sampleName } : {}),
    });
    const saved = saveVoicePersonas(next);
    setVoicePersonas(saved);
    setPersonaDraft({ id: '', label: '', referenceAudioUrl: '', sampleName: '' });
    setPersonaError('');
    setUploadError('');
  };

  const handleRemovePersona = (id: string) => {
    const saved = saveVoicePersonas(voicePersonas.filter((persona) => persona.id !== id));
    setVoicePersonas(saved);
    if (agentVoice === id) {
      setAgentVoice(getDefaultVoiceId(saved));
    }
  };

  const handleResetPersonas = () => {
    const saved = saveVoicePersonas([{ id: 'default', label: 'Default' }]);
    setVoicePersonas(saved);
    setPersonaDraft({ id: '', label: '', referenceAudioUrl: '', sampleName: '' });
    setPersonaError('');
    setUploadError('');
    setAgentVoice(getDefaultVoiceId(saved));
  };

  const handleSampleUploadClick = (target: 'draft' | string) => {
    setUploadTarget(target);
    sampleInputRef.current?.click();
  };

  const handleSampleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingSample(true);
    setUploadError('');
    try {
      const result = await voiceService.uploadReferenceAudio(file);
      if (!result.success || !result.audioUrl) {
        throw new Error(result.error || 'Upload failed.');
      }
      if (uploadTarget === 'draft') {
        setPersonaDraft((prev) => ({
          ...prev,
          referenceAudioUrl: result.audioUrl || '',
          sampleName: file.name,
        }));
      } else {
        const next = voicePersonas.map((persona) => (
          persona.id === uploadTarget
            ? { ...persona, referenceAudioUrl: result.audioUrl, sampleName: file.name }
            : persona
        ));
        const saved = saveVoicePersonas(next);
        setVoicePersonas(saved);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploadingSample(false);
      event.target.value = '';
    }
  };

  const handleClearSample = (id: string) => {
    const next = voicePersonas.map((persona) => (
      persona.id === id ? { ...persona, referenceAudioUrl: undefined, sampleName: undefined } : persona
    ));
    const saved = saveVoicePersonas(next);
    setVoicePersonas(saved);
  };

  const addUniqueValue = (
    value: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setDraft: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setList((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === trimmed.toLowerCase());
      return exists ? prev : prev.concat(trimmed);
    });
    setDraft('');
  };

  const toggleValue = (
    value: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList((prev) => (
      prev.includes(value) ? prev.filter((item) => item !== value) : prev.concat(value)
    ));
  };

  const recommendedVoice = React.useMemo(() => {
    const normalize = (input: string) => input.trim().toLowerCase();
    const intent = normalize(voiceIntent);
    const byIntent = voicePersonas.find((persona) => (
      normalize(persona.label).includes(intent) || normalize(persona.id).includes(intent)
    ));
    if (byIntent) {
      return { persona: byIntent, reason: `Matches intent "${voiceIntent}".` };
    }
    const traitIntent = traits.map((trait) => TRAIT_TO_INTENT[trait]).find(Boolean);
    if (traitIntent) {
      const traitMatch = voicePersonas.find((persona) => (
        normalize(persona.label).includes(traitIntent.toLowerCase())
        || normalize(persona.id).includes(traitIntent.toLowerCase())
      ));
      if (traitMatch) {
        return { persona: traitMatch, reason: `Matched trait intent "${traitIntent}".` };
      }
    }
    const fallback = voicePersonas[0] || { id: 'default', label: 'Default' };
    return { persona: fallback, reason: 'Default fallback.' };
  }, [voiceIntent, voicePersonas, traits]);

  const resolvePreviewText = (label: string) => {
    if (!previewText.includes('{name}')) return previewText;
    return previewText.replace('{name}', label || 'Agent');
  };

  const handlePreviewVoice = async (
    persona: { id: string; label: string; referenceAudioUrl?: string }
  ) => {
    setPreviewingId(persona.id);
    setPreviewError('');
    const text = resolvePreviewText(persona.label || persona.id);
    try {
      const result = persona.referenceAudioUrl
        ? await voiceService.speakWithVoice(text, persona.referenceAudioUrl)
        : await voiceService.speak(text, { voice: persona.id });
      if (!result.success) {
        setPreviewError(result.error || 'Preview failed.');
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed.');
    } finally {
      setPreviewingId(null);
    }
  };

  const slugify = (value: string) => (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );

  const parseJson = (value: string, label: string) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`${label} must be valid JSON`);
    }
  };

  const buildAgentSpec = (): AgentSpec => {
    const role = agentName.trim() || summaryTitle || 'agent';
    const id = slugify(role) || `agent-${Date.now()}`;
    const descriptionParts = [
      personaNotes.trim(),
      traits.length ? `Traits: ${traits.join(', ')}` : '',
      domains.length ? `Domains: ${domains.join(', ')}` : '',
      approachStyle ? `Approach: ${approachStyle}` : '',
      contextSkills.length ? `Context: ${contextSkills.join(', ')}` : '',
    ].filter(Boolean);
    return {
      id,
      role,
      description: descriptionParts.join(' | ') || 'Studio agent template',
      tools: [],
      policies: [],
      publisher: {
        publisher_id: agentPublisherId.trim(),
        public_key_id: agentPublicKeyId.trim(),
      },
      signature: {
        manifest_sig: agentSignature.trim(),
        bundle_hash: agentBundleHash.trim(),
      },
    };
  };

  const handleSaveAgent = async () => {
    const spec = buildAgentSpec();
    setAgentSaveStatus('Saving...');
    setStudioError('');
    try {
      const activeEntry = resolveActiveVaultEntry();
      if (!activeEntry) {
        throw new Error('Select a publisher identity to sign the agent.');
      }
      const secret = await ensureVaultSecret();
      const { key, existed } = await registerPublisherKey({
        publisher_id: activeEntry.publisherId,
        public_key_id: activeEntry.publicKeyId,
        public_key: activeEntry.publicKey,
      });
      if (!existed) {
        setPublisherKeyStatus(`Registered ${key.publisher_id}:${key.public_key_id}.`);
      }
      spec.publisher = {
        publisher_id: activeEntry.publisherId,
        public_key_id: activeEntry.publicKeyId,
      };
      const signature = await signAgentPayload(spec as unknown as Record<string, unknown>, secret);
      spec.signature = signature;
      setAgentPublisherId(activeEntry.publisherId);
      setAgentPublicKeyId(activeEntry.publicKeyId);
      setAgentSignature(signature.manifest_sig);
      setAgentBundleHash(signature.bundle_hash);
      await api.createAgentTemplate(spec);
      setAgentSaveStatus('Saved to registry.');
      loadAgentTemplates();
      await loadPublisherEvents();
    } catch (err) {
      setAgentSaveStatus('');
      setStudioError(normalizeError(err));
    }
  };

  const handleExportAgent = async () => {
    const spec = buildAgentSpec();
    setStudioError('');
    try {
      const activeEntry = resolveActiveVaultEntry();
      if (activeEntry) {
        try {
          const secret = await ensureVaultSecret();
          spec.publisher = {
            publisher_id: activeEntry.publisherId,
            public_key_id: activeEntry.publicKeyId,
          };
          const signature = await signAgentPayload(spec as unknown as Record<string, unknown>, secret);
          spec.signature = signature;
        } catch (err) {
          setStudioNotice('Copied unsigned agent definition (vault locked).');
        }
      }
      await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
      setStudioNotice('Agent definition copied to clipboard.');
    } catch (err) {
      setStudioError(normalizeError(err));
    }
  };

  const handleSaveTool = async () => {
    setToolFormError('');
    setToolSaveStatus('Saving...');
    setStudioError('');
    try {
      const resolvedId = toolId.trim() || slugify(toolName);
      if (!resolvedId) {
        throw new Error('Tool ID is required.');
      }
      const resolvedName = toolName.trim() || resolvedId;
      if (!resolvedName) {
        throw new Error('Tool name is required.');
      }
      if (toolType === 'Local' && !toolCommand.trim()) {
        throw new Error('Command is required for local tools.');
      }
      if (toolType === 'Http' && !toolEndpoint.trim()) {
        throw new Error('Endpoint is required for HTTP tools.');
      }
      const inputSchema = parseJson(toolInputSchema, 'Input schema');
      const outputSchema = parseJson(toolOutputSchema, 'Output schema');
      const toolDef: ToolGatewayDefinition = {
        id: resolvedId,
        name: resolvedName,
        description: toolDescription.trim(),
        tool_type: toolType,
        command: toolType === 'Local' ? toolCommand.trim() : '',
        endpoint: toolType === 'Http' ? toolEndpoint.trim() : '',
        input_schema: inputSchema,
        output_schema: outputSchema,
        side_effects: [],
        idempotency_behavior: 'unknown',
        retryable: false,
        failure_classification: 'unknown',
        safety_tier: toolSafetyTier,
        resource_limits: {
          cpu: null,
          memory: null,
          network: 'Unrestricted',
          filesystem: 'None',
          time_limit: 300,
        },
      };
      await api.createTool(toolDef);
      setToolSaveStatus('Saved to registry.');
      setToolId(resolvedId);
      loadTools();
    } catch (err) {
      setToolSaveStatus('');
      setToolFormError(normalizeError(err));
    }
  };

  const handleTestTool = async () => {
    setToolTestStatus('Running...');
    setToolFormError('');
    setStudioError('');
    setToolTestResult(null);
    try {
      const resolvedId = toolId.trim() || slugify(toolName);
      if (!resolvedId) {
        throw new Error('Tool ID is required for execution.');
      }
      const input = parseJson(toolTestInput, 'Test input');
      const result = await api.executeTool(resolvedId, { input });
      setToolTestResult(result);
      setToolTestStatus(`Execution ${result.execution_id} complete.`);
    } catch (err) {
      setToolTestStatus('');
      setToolFormError(normalizeError(err));
    }
  };

  const handleSaveWorkflow = async () => {
    setWorkflowFormError('');
    setWorkflowStatus('Saving...');
    setStudioError('');
    try {
      const workflow = parseJson(workflowDraft, 'Workflow definition') as WorkflowDefinition;
      if (!workflow.workflow_id) {
        throw new Error('workflow_id is required.');
      }
      await api.createWorkflow(workflow);
      setWorkflowStatus('Saved to registry.');
      setSelectedWorkflowId(workflow.workflow_id);
      loadWorkflows();
    } catch (err) {
      setWorkflowStatus('');
      setWorkflowFormError(normalizeError(err));
    }
  };

  const handleExecuteWorkflow = async () => {
    setWorkflowFormError('');
    setWorkflowStatus('Executing...');
    setStudioError('');
    try {
      const workflowId = selectedWorkflowId.trim();
      if (!workflowId) {
        throw new Error('Select a workflow to execute.');
      }
      const input = parseJson(workflowInput, 'Workflow input');
      const execution = await api.executeWorkflow(workflowId, { input });
      setWorkflowExecution(execution);
      setWorkflowStatus(`Execution ${execution.execution_id} complete.`);
    } catch (err) {
      setWorkflowStatus('');
      setWorkflowFormError(normalizeError(err));
    }
  };

  const selectedPersona = voicePersonas.find((persona) => persona.id === agentVoice);
  const summaryTitle = [
    traits[0],
    domains[0],
    'Agent',
  ].filter(Boolean).join(' ');
  const isPreviewing = previewingId !== null;

  return (
    <div className="studio-view" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="studio-header" style={{
        padding: '16px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          color: '#1e293b',
          fontWeight: '600'
        }}>
          Studio - Asset & Definition Authoring
        </h1>
        <div className="studio-space-selector" style={{
          display: 'flex',
          gap: '8px',
          padding: '4px',
          backgroundColor: '#e2e8f0',
          borderRadius: '8px'
        }}>
          <button
            className={`space-btn ${activeSpace === 'builders' ? 'active' : ''}`}
            onClick={() => setActiveSpace('builders')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: activeSpace === 'builders' ? 'white' : 'transparent',
              fontWeight: activeSpace === 'builders' ? '600' : 'normal',
              color: activeSpace === 'builders' ? '#3b82f6' : '#64748b'
            }}
          >
            Builders
          </button>
          <button
            className={`space-btn ${activeSpace === 'pipelines' ? 'active' : ''}`}
            onClick={() => setActiveSpace('pipelines')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: activeSpace === 'pipelines' ? 'white' : 'transparent',
              fontWeight: activeSpace === 'pipelines' ? '600' : 'normal',
              color: activeSpace === 'pipelines' ? '#3b82f6' : '#64748b'
            }}
          >
            Pipelines
          </button>
          <button
            className={`space-btn ${activeSpace === 'artifacts' ? 'active' : ''}`}
            onClick={() => setActiveSpace('artifacts')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: activeSpace === 'artifacts' ? 'white' : 'transparent',
              fontWeight: activeSpace === 'artifacts' ? '600' : 'normal',
              color: activeSpace === 'artifacts' ? '#3b82f6' : '#64748b'
            }}
          >
            Artifacts
          </button>
          <button
            className={`space-btn ${activeSpace === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveSpace('templates')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: activeSpace === 'templates' ? 'white' : 'transparent',
              fontWeight: activeSpace === 'templates' ? '600' : 'normal',
              color: activeSpace === 'templates' ? '#3b82f6' : '#64748b'
            }}
          >
            Templates
          </button>
        </div>
      </div>

      {(studioError || studioNotice) && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: studioError ? '#fee2e2' : '#eff6ff',
          color: studioError ? '#991b1b' : '#1d4ed8',
          fontSize: '14px'
        }}>
          {studioError || studioNotice}
        </div>
      )}

      <div className="studio-content" style={{
        flex: 1,
        padding: '24px',
        overflow: 'hidden', /* Changed from 'auto' to 'hidden' to prevent double scrollbars */
        backgroundColor: '#f1f5f9'
      }}>
        {activeSpace === 'builders' && (
          <div className="builders-space">
            <div className="builder-selector" style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px'
            }}>
              <button
                className={`builder-btn ${activeBuilder === 'agent' ? 'active' : ''}`}
                onClick={() => setActiveBuilder('agent')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeBuilder === 'agent' ? '#dbeafe' : 'white',
                  color: activeBuilder === 'agent' ? '#3b82f6' : '#64748b'
                }}
              >
                Agent Builder
              </button>
              <button
                className={`builder-btn ${activeBuilder === 'workflow' ? 'active' : ''}`}
                onClick={() => setActiveBuilder('workflow')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeBuilder === 'workflow' ? '#dbeafe' : 'white',
                  color: activeBuilder === 'workflow' ? '#3b82f6' : '#64748b'
                }}
              >
                Workflow Builder
              </button>
              <button
                className={`builder-btn ${activeBuilder === 'tool' ? 'active' : ''}`}
                onClick={() => setActiveBuilder('tool')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeBuilder === 'tool' ? '#dbeafe' : 'white',
                  color: activeBuilder === 'tool' ? '#3b82f6' : '#64748b'
                }}
              >
                Tool Builder
              </button>
              <button
                className={`builder-btn ${activeBuilder === 'skill' ? 'active' : ''}`}
                onClick={() => setActiveBuilder('skill')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeBuilder === 'skill' ? '#dbeafe' : 'white',
                  color: activeBuilder === 'skill' ? '#3b82f6' : '#64748b'
                }}
              >
                Skill Builder
              </button>
            </div>

            {activeBuilder === 'agent' && (
              <div className="agent-builder" style={{ display: 'flex', gap: '24px' }}>
                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Agent Definition</h3>
                  <input
                    ref={sampleInputRef}
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={handleSampleChange}
                  />

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Agent Name</label>
                    <input
                      type="text"
                      placeholder="Enter agent name"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                      Build a specialist by combining traits, domains, routing, and voice.
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                      Agent Publisher Identity
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Publisher Id</label>
                        <input
                          type="text"
                          placeholder="your.publisher"
                          value={agentPublisherId}
                          onChange={(e) => setAgentPublisherId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Public Key Id</label>
                        <input
                          type="text"
                          placeholder="key1"
                          value={agentPublicKeyId}
                          onChange={(e) => setAgentPublicKeyId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Manifest Signature (base64)</label>
                        <textarea
                          value={agentSignature}
                          readOnly
                          placeholder="Auto-generated on save"
                          style={{
                            width: '100%',
                            minHeight: '70px',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Bundle Hash</label>
                        <input
                          type="text"
                          placeholder="sha256:<hex>"
                          value={agentBundleHash}
                          readOnly
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Signatures are generated automatically when the local vault is unlocked.
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                      Agent Composition
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Personality Traits</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {TRAIT_OPTIONS.map((trait) => {
                          const active = traits.includes(trait);
                          return (
                            <button
                              key={trait}
                              type="button"
                              onClick={() => toggleValue(trait, setTraits)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '999px',
                                border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
                                backgroundColor: active ? '#dbeafe' : 'white',
                                color: active ? '#1d4ed8' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              {trait}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Add trait"
                          value={traitDraft}
                          onChange={(e) => setTraitDraft(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addUniqueValue(traitDraft, setTraits, setTraitDraft)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: 'white',
                            color: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                      {traits.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {traits.map((trait) => (
                            <button
                              key={trait}
                              type="button"
                              onClick={() => toggleValue(trait, setTraits)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {trait} x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Domain Expertise</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {DOMAIN_OPTIONS.map((domain) => {
                          const active = domains.includes(domain);
                          return (
                            <button
                              key={domain}
                              type="button"
                              onClick={() => toggleValue(domain, setDomains)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '999px',
                                border: `1px solid ${active ? '#0ea5e9' : '#cbd5e1'}`,
                                backgroundColor: active ? '#e0f2fe' : 'white',
                                color: active ? '#0369a1' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              {domain}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Add domain"
                          value={domainDraft}
                          onChange={(e) => setDomainDraft(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addUniqueValue(domainDraft, setDomains, setDomainDraft)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: 'white',
                            color: '#0ea5e9',
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                      {domains.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {domains.map((domain) => (
                            <button
                              key={domain}
                              type="button"
                              onClick={() => toggleValue(domain, setDomains)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {domain} x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Approach Style</label>
                      <select
                        value={approachStyle}
                        onChange={(e) => setApproachStyle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        {APPROACH_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Context Routing</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {SKILL_OPTIONS.map((skill) => {
                          const active = contextSkills.includes(skill);
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleValue(skill, setContextSkills)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '999px',
                                border: `1px solid ${active ? '#22c55e' : '#cbd5e1'}`,
                                backgroundColor: active ? '#dcfce7' : 'white',
                                color: active ? '#15803d' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Add skill"
                          value={contextSkillDraft}
                          onChange={(e) => setContextSkillDraft(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addUniqueValue(contextSkillDraft, setContextSkills, setContextSkillDraft)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: 'white',
                            color: '#22c55e',
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                      {contextSkills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {contextSkills.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleValue(skill, setContextSkills)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {skill} x
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                        Selected skills preload the agent with focused context.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Personality & Constraints</label>
                    <textarea
                      placeholder="Define agent personality, constraints, and permissions..."
                      value={personaNotes}
                      onChange={(e) => setPersonaNotes(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Operating Mode</label>
                    <select
                      value={operatingMode}
                      onChange={(e) => setOperatingMode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <option value="fast">Fast</option>
                      <option value="reasoning">Reasoning</option>
                      <option value="eval">Eval</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Voice Intent</label>
                    <select
                      value={voiceIntent}
                      onChange={(e) => setVoiceIntent(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      {VOICE_INTENTS.map((intent) => (
                        <option key={intent} value={intent}>{intent}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                      Suggests a voice that matches the agent personality.
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Voice Persona</label>
                    <select
                      value={agentVoice}
                      onChange={(e) => setAgentVoice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      {voicePersonas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (recommendedVoice.persona?.id) {
                            setAgentVoice(recommendedVoice.persona.id);
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'white',
                          color: '#3b82f6',
                          cursor: 'pointer'
                        }}
                      >
                        Use recommended
                      </button>
                      <button
                        type="button"
                        disabled={!recommendedVoice.persona || isPreviewing}
                        onClick={() => {
                          if (recommendedVoice.persona) {
                            handlePreviewVoice({
                              id: recommendedVoice.persona.id,
                              label: recommendedVoice.persona.label || recommendedVoice.persona.id,
                              referenceAudioUrl: recommendedVoice.persona.referenceAudioUrl,
                            });
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'white',
                          color: '#334155',
                          cursor: 'pointer',
                          opacity: isPreviewing ? 0.6 : 1
                        }}
                      >
                        {previewingId === (recommendedVoice.persona?.id ?? '') ? 'Playing...' : 'Preview recommended'}
                      </button>
                      <button
                        type="button"
                        disabled={!selectedPersona || isPreviewing}
                        onClick={() => {
                          if (selectedPersona) {
                            handlePreviewVoice({
                              id: selectedPersona.id,
                              label: selectedPersona.label || selectedPersona.id,
                              referenceAudioUrl: selectedPersona.referenceAudioUrl,
                            });
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'white',
                          color: '#334155',
                          cursor: 'pointer',
                          opacity: isPreviewing ? 0.6 : 1
                        }}
                      >
                        {previewingId === (selectedPersona?.id ?? '') ? 'Playing...' : 'Preview voice'}
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                      Recommended: {recommendedVoice.persona?.label || 'Default'} - {recommendedVoice.reason}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
                        Preview text
                      </label>
                      <input
                        type="text"
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px'
                        }}
                      />
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        Use {'{name}'} to insert the agent or persona label.
                      </div>
                    </div>
                    {previewError && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
                        {previewError}
                      </div>
                    )}
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                      Used by Chatterbox TTS for this agent build.
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong style={{ color: '#334155' }}>Chatterbox Persona Library</strong>
                      <button
                        type="button"
                        onClick={handleResetPersonas}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: 'white',
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        Reset
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="voice_id"
                        value={personaDraft.id}
                        onChange={(e) => setPersonaDraft((prev) => ({ ...prev, id: e.target.value }))}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Label"
                        value={personaDraft.label}
                        onChange={(e) => setPersonaDraft((prev) => ({ ...prev, label: e.target.value }))}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleSampleUploadClick('draft')}
                          disabled={isUploadingSample}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: 'white',
                            color: '#3b82f6',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          {personaDraft.referenceAudioUrl ? 'Sample ✓' : 'Attach'}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddPersona}
                          style={{
                            padding: '10px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {personaError && (
                      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#dc2626' }}>
                        {personaError}
                      </div>
                    )}
                    {uploadError && (
                      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#dc2626' }}>
                        {uploadError}
                      </div>
                    )}
                    {personaDraft.referenceAudioUrl && (
                      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#64748b' }}>
                        Draft sample: {personaDraft.sampleName || 'reference_audio'}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {voicePersonas.length === 0 && (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>No personas defined yet.</div>
                      )}
                      {voicePersonas.map((persona) => (
                        <div
                          key={persona.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#334155' }}>{persona.label}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{persona.id}</div>
                            {persona.referenceAudioUrl && (
                              <div style={{ fontSize: '12px', color: '#10b981' }}>
                                Sample attached: {persona.sampleName || 'reference_audio'}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handlePreviewVoice({
                                id: persona.id,
                                label: persona.label || persona.id,
                                referenceAudioUrl: persona.referenceAudioUrl,
                              })}
                              disabled={isPreviewing}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: 'white',
                                color: '#334155',
                                cursor: 'pointer',
                                opacity: isPreviewing ? 0.6 : 1
                              }}
                            >
                              {previewingId === persona.id ? 'Playing...' : 'Preview'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSampleUploadClick(persona.id)}
                              disabled={isUploadingSample}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: 'white',
                                color: '#3b82f6',
                                cursor: 'pointer'
                              }}
                            >
                              {persona.referenceAudioUrl ? 'Replace' : 'Attach'}
                            </button>
                            {persona.referenceAudioUrl && (
                              <button
                                type="button"
                                onClick={() => handleClearSample(persona.id)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  backgroundColor: '#f8fafc',
                                  color: '#64748b',
                                  cursor: 'pointer'
                                }}
                              >
                                Clear
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemovePersona(persona.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc',
                                color: '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                      Voice personas are created once and mapped to agents.
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '20px',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Agent Profile Preview
                    </div>
                    <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>
                      {agentName || summaryTitle || 'Unnamed Agent'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Traits: {traits.length ? traits.join(', ') : 'None selected'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Domains: {domains.length ? domains.join(', ') : 'None selected'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Approach: {approachStyle}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Context routing: {contextSkills.length ? contextSkills.join(', ') : 'None selected'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Voice intent: {voiceIntent}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Voice persona: {selectedPersona?.label || agentVoice}
                    </div>
                    {personaNotes && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                        Notes: {personaNotes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={handleSaveAgent}>
                      Save to Registry
                    </button>
                    <button style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#e2e8f0',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={handleExportAgent}>
                      Export Definition
                    </button>
                  </div>
                  {agentSaveStatus && (
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#1d4ed8' }}>
                      {agentSaveStatus}
                    </div>
                  )}
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Registry Templates
                    </div>
                    {agentsLoading && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading templates...</div>
                    )}
                    {!agentsLoading && agentTemplates.length === 0 && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>No templates registered.</div>
                    )}
                    {!agentsLoading && agentTemplates.length > 0 && (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {agentTemplates.map((template) => (
                          <div key={template.id} style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '10px',
                            backgroundColor: '#f8fafc'
                          }}>
                            <div style={{ fontWeight: 600, color: '#334155' }}>{template.role}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{template.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Agent-Assisted Building</h3>
                  <div style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    height: '300px',
                    marginBottom: '16px',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ fontSize: '24px', textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                      🤖 AI Designer
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Ask AI to design: 'Create a code review agent that...' "
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1'
                      }}
                    />
                    <button style={{
                      padding: '10px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      opacity: 0.6
                    }}
                    disabled
                    title="AI-assisted design is not wired yet.">
                      Ask
                    </button>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '14px', color: '#64748b' }}>
                    <p><strong>Examples:</strong></p>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li>"Generate workflow from this goal"</li>
                      <li>"Refactor this pipeline"</li>
                      <li>"Convert these browser clips into a spec"</li>
                      <li>"Create tool schema from this CLI help output"</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeBuilder === 'workflow' && (
              <div className="workflow-builder" style={{ display: 'flex', gap: '24px' }}>
                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Workflow Builder</h3>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Workflow Definition (JSON)
                    </label>
                    <textarea
                      value={workflowDraft}
                      onChange={(e) => setWorkflowDraft(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '320px',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={handleSaveWorkflow}>
                      Save to Registry
                    </button>
                  </div>
                  {(workflowFormError || workflowStatus) && (
                    <div style={{ marginTop: '12px', fontSize: '12px', color: workflowFormError ? '#b91c1c' : '#1d4ed8' }}>
                      {workflowFormError || workflowStatus}
                    </div>
                  )}
                </div>

                <div style={{
                  width: '300px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Workflow Registry</h3>
                  {workflowsLoading && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                      Loading workflows...
                    </div>
                  )}
                  {!workflowsLoading && workflows.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                      No workflows registered.
                    </div>
                  )}
                  {!workflowsLoading && workflows.length > 0 && (
                    <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                      {workflows.map((workflow) => (
                        <button
                          key={workflow.workflow_id}
                          type="button"
                          onClick={() => setSelectedWorkflowId(workflow.workflow_id)}
                          style={{
                            textAlign: 'left',
                            padding: '10px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: selectedWorkflowId === workflow.workflow_id ? '#dbeafe' : '#f8fafc',
                            color: '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{workflow.workflow_id}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{workflow.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Execute Input (JSON)
                    </label>
                    <textarea
                      value={workflowInput}
                      onChange={(e) => setWorkflowInput(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <button style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  onClick={handleExecuteWorkflow}>
                    Execute Workflow
                  </button>
                  {workflowExecution && (
                    <div style={{ marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Last Execution</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {workflowExecution.execution_id} · {workflowExecution.status}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeBuilder === 'tool' && (
              <div className="tool-builder">
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Tool Builder</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tool ID</label>
                      <input
                        type="text"
                        placeholder="unique.tool.id"
                        value={toolId}
                        onChange={(e) => setToolId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tool Name</label>
                      <input
                        type="text"
                        placeholder="Enter tool name"
                        value={toolName}
                        onChange={(e) => setToolName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Tool Type</label>
                      <select
                        value={toolType}
                        onChange={(e) => setToolType(e.target.value as ToolType)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        <option value="Local">Local Command</option>
                        <option value="Http">HTTP Endpoint</option>
                      </select>
                    </div>

                    {toolType === 'Local' && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Command</label>
                        <input
                          type="text"
                          placeholder="/usr/bin/tool --arg"
                          value={toolCommand}
                          onChange={(e) => setToolCommand(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>
                    )}

                    {toolType === 'Http' && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Endpoint</label>
                        <input
                          type="text"
                          placeholder="https://api.example.com/execute"
                          value={toolEndpoint}
                          onChange={(e) => setToolEndpoint(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Safety Tier</label>
                      <select
                        value={toolSafetyTier}
                        onChange={(e) => setToolSafetyTier(e.target.value as SafetyTier)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        <option value="T0">T0</option>
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                        <option value="T4">T4</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Description</label>
                      <textarea
                        placeholder="Describe what this tool does..."
                        value={toolDescription}
                        onChange={(e) => setToolDescription(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Parameters Schema</label>
                      <textarea
                        placeholder='{ "params": { "type": "object", "properties": { ... } } }'
                        value={toolInputSchema}
                        onChange={(e) => setToolInputSchema(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '150px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                        resize: 'vertical'
                      }}
                    />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Output Schema</label>
                      <textarea
                        placeholder='{ "type": "object", "properties": { ... } }'
                        value={toolOutputSchema}
                        onChange={(e) => setToolOutputSchema(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Test Input</label>
                      <textarea
                        placeholder='{ "example": "value" }'
                        value={toolTestInput}
                        onChange={(e) => setToolTestInput(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
                      <button style={{
                        flex: 1,
                        padding: '10px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={handleSaveTool}>
                        Save to Registry
                      </button>
                      <button style={{
                        flex: 1,
                        padding: '10px',
                        backgroundColor: '#e2e8f0',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={handleTestTool}>
                        Test Tool
                      </button>
                    </div>
                    {(toolSaveStatus || toolTestStatus || toolFormError) && (
                      <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: toolFormError ? '#b91c1c' : '#1d4ed8' }}>
                        {toolFormError || toolSaveStatus || toolTestStatus}
                      </div>
                    )}
                    {toolTestResult && (
                      <div style={{ gridColumn: '1 / -1', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', backgroundColor: '#f8fafc' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Execution Result</div>
                        <pre style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(toolTestResult, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                        Registered Tools
                      </div>
                      {toolsLoading && (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading tools...</div>
                      )}
                      {!toolsLoading && tools.length === 0 && (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>No tools registered.</div>
                      )}
                      {!toolsLoading && tools.length > 0 && (
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {tools.map((tool) => (
                            <button
                              key={tool.name}
                              type="button"
                              onClick={() => {
                                setToolId(tool.name);
                                setToolName(tool.name);
                                setToolDescription(tool.description || '');
                              }}
                              style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '10px',
                                backgroundColor: toolId === tool.name ? '#dbeafe' : '#f8fafc',
                                textAlign: 'left',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontWeight: 600, color: '#334155' }}>{tool.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{tool.description}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeBuilder === 'skill' && (
              <div className="skill-builder">
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#334155' }}>Skill Builder</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(320px, 1.1fr)', gap: '24px' }}>
                    <div>
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: '#f8fafc',
                        marginBottom: '16px'
                      }}>
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Local Identity Vault
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                          Generate and store signing keys locally. Active keys are auto-registered when you save.
                        </div>
                        <div style={{ display: 'grid', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                              Vault Passphrase
                            </label>
                            <input
                              type="password"
                              value={vaultPassphrase}
                              onChange={(event) => setVaultPassphrase(event.target.value)}
                              placeholder="Passphrase to unlock"
                              style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={handleGenerateVaultKey}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #1d4ed8',
                                backgroundColor: '#1d4ed8',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              Generate Key
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlockVault}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: 'white',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              Unlock
                            </button>
                            <button
                              type="button"
                              onClick={handleLockVault}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              Lock
                            </button>
                          </div>
                          {(vaultError || vaultStatus) && (
                            <div style={{ fontSize: '12px', color: vaultError ? '#b91c1c' : '#1d4ed8' }}>
                              {vaultError || vaultStatus}
                            </div>
                          )}
                          {vaultEntries.length > 0 && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                          {vaultEntries.map((entry) => {
                            const isActive = entry.id === vaultActiveId;
                            const keyId = `${entry.publisherId}:${entry.publicKeyId}`;
                            const isRegistered = publisherKeyIndex.active.has(keyId);
                            const isRevoked = publisherKeyIndex.revoked.has(keyId);
                            const statusLabel = isRevoked ? 'Revoked' : isRegistered ? 'Registered' : 'Unregistered';
                            const statusColor = isRevoked ? '#b91c1c' : isRegistered ? '#16a34a' : '#d97706';
                            return (
                              <div key={entry.id} style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '10px',
                                backgroundColor: isActive ? '#dbeafe' : 'white'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 600, color: '#334155' }}>
                                    {entry.publisherId} · {entry.publicKeyId}
                                  </div>
                                  <div style={{ fontSize: '11px', color: statusColor }}>
                                    {statusLabel}
                                  </div>
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  Created: {new Date(entry.createdAt).toLocaleString()}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                  <button
                                        type="button"
                                        onClick={() => handleActivateVaultEntry(entry)}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: isActive ? '#e0f2fe' : '#f8fafc',
                                          color: '#1d4ed8',
                                          cursor: 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >
                                        {isActive ? 'Active' : 'Use for Signing'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRegisterVaultEntry(entry)}
                                        disabled={isRegistered || isRevoked}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid #1d4ed8',
                                          backgroundColor: isRegistered ? '#e2e8f0' : 'white',
                                          color: isRegistered ? '#94a3b8' : '#1d4ed8',
                                          cursor: isRegistered || isRevoked ? 'not-allowed' : 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >
                                        {isRevoked ? 'Revoked' : isRegistered ? 'Registered' : 'Register with Kernel'}
                                      </button>
                                    </div>
                                  </div>
                                );
                          })}
                            </div>
                          )}
                          {vaultEntries.length === 0 && (
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              No local keys yet. Generate a key to enable auto-signing.
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Publisher Keys</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                        Register base64-encoded Ed25519 public keys for skills and agents.
                      </div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Publisher Id</label>
                          <input
                            type="text"
                            value={publisherId}
                            onChange={(event) => setPublisherId(event.target.value)}
                            placeholder="your.publisher"
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Public Key Id</label>
                          <input
                            type="text"
                            value={publisherPublicKeyId}
                            onChange={(event) => setPublisherPublicKeyId(event.target.value)}
                            placeholder="key1"
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Public Key (base64)</label>
                          <textarea
                            value={publisherPublicKey}
                            onChange={(event) => setPublisherPublicKey(event.target.value)}
                            placeholder="Base64-encoded 32-byte Ed25519 public key"
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleRegisterPublisherKey}
                          style={{
                            padding: '10px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: '1px solid #1d4ed8',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Register Key
                        </button>
                        {(publisherKeyError || publisherKeyStatus) && (
                          <div style={{ fontSize: '12px', color: publisherKeyError ? '#b91c1c' : '#1d4ed8' }}>
                            {publisherKeyError || publisherKeyStatus}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: '18px' }}>
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                          Registered Publisher Keys
                        </div>
                        {publisherKeysLoading && (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading publisher keys...</div>
                        )}
                        {!publisherKeysLoading && publisherKeys.length === 0 && (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>No publisher keys registered.</div>
                        )}
                        {!publisherKeysLoading && publisherKeys.length > 0 && (
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {publisherKeys.map((key) => (
                              <div key={`${key.publisher_id}:${key.public_key_id}`} style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '10px',
                                backgroundColor: key.revoked ? '#fef2f2' : '#f8fafc'
                              }}>
                                <div style={{ fontWeight: 600, color: '#334155' }}>
                                  {key.publisher_id} · {key.public_key_id}
                                </div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  Created: {key.created_at} {key.revoked ? '· Revoked' : ''}
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokePublisherKey(key)}
                                    disabled={key.revoked}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: key.revoked ? '#e2e8f0' : '#fee2e2',
                                      color: key.revoked ? '#94a3b8' : '#b91c1c',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      cursor: key.revoked ? 'not-allowed' : 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    Revoke Key
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: '18px' }}>
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                          Publishing Activity
                        </div>
                        {publisherEventsLoading && (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading activity...</div>
                        )}
                        {!publisherEventsLoading && publisherEvents.length === 0 && (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>No recent activity.</div>
                        )}
                        {!publisherEventsLoading && publisherEvents.length > 0 && (
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {publisherEvents.map((event) => (
                              <div key={event.eventId} style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '10px',
                                backgroundColor: '#f8fafc'
                              }}>
                                <div style={{ fontWeight: 600, color: '#334155' }}>{event.kind}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {new Date(event.timestamp * 1000).toLocaleString()}
                                </div>
                                <pre style={{ margin: '8px 0 0', fontSize: '11px', color: '#475569', whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(event.payload, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Skill JSON</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                        The vault auto-signs the bundle on save (Ed25519 over sha256 bundle hash).
                      </div>
                      <textarea
                        value={skillDraft}
                        onChange={(event) => setSkillDraft(event.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '320px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={handleSaveSkill}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: '#1d4ed8',
                            color: 'white',
                            border: '1px solid #1d4ed8',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Save to Registry
                        </button>
                        <button
                          type="button"
                          onClick={handleResetSkillDraft}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          Reset Draft
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Skill execution is not available yet."
                          style={{
                            padding: '10px 14px',
                            backgroundColor: '#e2e8f0',
                            color: '#94a3b8',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'not-allowed'
                          }}
                        >
                          Test Skill
                        </button>
                      </div>
                      {(skillSaveError || skillSaveStatus) && (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: skillSaveError ? '#b91c1c' : '#1d4ed8' }}>
                          {skillSaveError || skillSaveStatus}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Registered Skills
                    </div>
                    {skillsLoading && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading skills...</div>
                    )}
                    {!skillsLoading && skills.length === 0 && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>No skills registered.</div>
                    )}
                    {!skillsLoading && skills.length > 0 && (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {skills.map((skill) => (
                          <button
                            key={skill.manifest.id}
                            type="button"
                            onClick={() => setSkillDraft(JSON.stringify(skill, null, 2))}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '10px',
                              backgroundColor: '#f8fafc',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontWeight: 600, color: '#334155' }}>{skill.manifest.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{skill.manifest.description}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {skill.manifest.id} · {skill.manifest.version}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSpace === 'pipelines' && (
          <div className="pipelines-space" style={{ height: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column' }}>
            <div className="pipeline-selector" style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px'
            }}>
              <button
                className={`pipeline-btn ${activePipeline === 'comfyui' ? 'active' : ''}`}
                onClick={() => setActivePipeline('comfyui')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activePipeline === 'comfyui' ? '#dbeafe' : 'white',
                  color: activePipeline === 'comfyui' ? '#3b82f6' : '#64748b'
                }}
              >
                ComfyUI Graphs
              </button>
            </div>

            {activePipeline === 'comfyui' && (
              <div className="comfyui-pipeline" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ color: '#1e293b', margin: 0 }}>ComfyUI Pipeline Editor</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => window.open('http://127.0.0.1:8188', '_blank')}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e2e8f0',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Open ComfyUI
                    </button>
                    <button style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'not-allowed',
                      opacity: 0.6
                    }}
                    disabled
                    title="Pipeline registry save is not wired yet. Save inside ComfyUI.">
                      Save Graph
                    </button>
                  </div>
                </div>
                <div style={{
                  flex: 1,
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  minHeight: '600px'
                }}>
                  <iframe
                    src="http://127.0.0.1:8188"
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '600px',
                      border: 'none'
                    }}
                    title="ComfyUI"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeSpace === 'artifacts' && (
          <div className="artifacts-space">
            <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>Artifacts Repository</h2>
            {artifactsLoading && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Loading artifacts...</div>
            )}
            {!artifactsLoading && artifacts.length === 0 && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>No artifacts found.</div>
            )}
            {!artifactsLoading && artifacts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {artifacts.map((artifact) => (
                  <div
                    key={artifact.artifact_id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      {artifact.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                      {artifact.artifact_type}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {artifact.artifact_id}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                      {new Date(artifact.created_at * 1000).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSpace === 'templates' && (
          <div className="templates-space">
            <h2 style={{ color: '#1e293b', marginBottom: '24px' }}>Templates Library</h2>
            {templatesLoading && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Loading templates...</div>
            )}
            {!templatesLoading && !templatesIndex && (
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Templates are not available.</div>
            )}
            {!templatesLoading && templatesIndex && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#334155' }}>Agent Templates</h3>
                  {templatesIndex.agents.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>No agent templates.</div>
                  )}
                  {templatesIndex.agents.length > 0 && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {templatesIndex.agents.map((agent) => (
                        <div key={agent.id} style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '10px',
                          backgroundColor: '#f8fafc'
                        }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{agent.role}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{agent.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#334155' }}>Workflow Templates</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {templatesIndex.workflows.length ? `${templatesIndex.workflows.length} workflow templates` : 'No workflow templates.'}
                  </div>
                </div>

                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#334155' }}>Pipeline Templates</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {templatesIndex.pipelines.length ? `${templatesIndex.pipelines.length} pipeline templates` : 'No pipeline templates.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
