import type {
  AgentSetup,
  AvatarConfig,
  BanViolation,
  CharacterArtifactFile,
  CharacterBlueprint,
  CharacterCompiledConfig,
  CharacterLayerConfig,
  CharacterLintIssue,
  CharacterStatDefinition,
  CharacterStats,
  CharacterTelemetryEvent,
  HardBanCategory,
  RelationshipConfig,
  RoleCardConfig,
  RoleHardBan,
} from "./character.types";

const STORAGE_PREFIX = "a2r:character";
const MAX_TELEMETRY_EVENTS = 1000;

const DEFAULT_SETUP: AgentSetup = "generalist";

interface SetupDefinition {
  setup: AgentSetup;
  label: string;
  className: string;
  description: string;
  temperament: CharacterBlueprint["temperament"];
  voiceStyle: string;
  domain: string;
  outputs: string[];
  definitionOfDone: string[];
  escalation: string[];
  metrics: string[];
  avatarColor: string;
  progression: CharacterLayerConfig["progression"];
}

export const CHARACTER_SETUPS: Array<{
  id: AgentSetup;
  label: string;
  description: string;
  className: string;
}> = [
  {
    id: "coding",
    label: "Coding Specialist",
    description: "Implements, reviews, and stabilizes software changes.",
    className: "Builder",
  },
  {
    id: "creative",
    label: "Creative Specialist",
    description: "Generates campaigns, narratives, and design-forward output.",
    className: "Creator",
  },
  {
    id: "research",
    label: "Research Specialist",
    description: "Synthesizes evidence and produces decision-grade analysis.",
    className: "Analyst",
  },
  {
    id: "operations",
    label: "Operations Specialist",
    description: "Optimizes reliability, safety, and operational execution.",
    className: "Operator",
  },
  {
    id: "generalist",
    label: "Generalist",
    description: "Balanced execution across mixed task classes.",
    className: "Generalist",
  },
];

export const CHARACTER_SPECIALTY_OPTIONS: Record<AgentSetup, string[]> = {
  coding: [
    "TypeScript",
    "API design",
    "Debugging",
    "Testing",
    "Refactoring",
    "Performance",
    "Security hardening",
  ],
  creative: [
    "Storytelling",
    "Brand voice",
    "Campaign concepts",
    "Visual direction",
    "Copywriting",
    "Community growth",
  ],
  research: [
    "Competitive analysis",
    "Data interpretation",
    "Source validation",
    "Synthesis",
    "Risk framing",
    "Decision memos",
  ],
  operations: [
    "Runbooks",
    "Incident response",
    "Reliability",
    "Cost control",
    "Security policy",
    "Deployment safety",
  ],
  generalist: [
    "Coordination",
    "Execution planning",
    "Documentation",
    "Quality checks",
    "Stakeholder updates",
    "Tooling hygiene",
  ],
};

const SETUP_STAT_DEFINITIONS: Record<AgentSetup, CharacterStatDefinition[]> = {
  coding: [
    {
      key: "RIG",
      label: "Implementation Reliability",
      description: "How consistently code changes land without regressions or policy breaks.",
      signals: ["mission_success_rate", "step_completion_rate", "ban_rate"],
    },
    {
      key: "THR",
      label: "Code Throughput",
      description: "How quickly validated implementation steps complete per mission.",
      signals: ["throughput_per_mission"],
    },
    {
      key: "SAF",
      label: "Security Hygiene",
      description: "How consistently risky actions are contained with guardrails and escalations.",
      signals: ["safety_index", "escalation_rate"],
    },
    {
      key: "FIT",
      label: "Debug/Test Fidelity",
      description: "How well execution avoids failure while preserving step completion quality.",
      signals: ["mission_failure_rate", "step_completion_rate"],
    },
  ],
  creative: [
    {
      key: "CRE",
      label: "Creative Originality",
      description: "Measured ideation quality and variation under production constraints.",
      signals: ["memory_density", "challenge_rate", "collaboration_rate"],
    },
    {
      key: "RES",
      label: "Audience Resonance",
      description: "How often creative outputs hand off successfully and complete missions.",
      signals: ["collaboration_rate", "mission_success_rate"],
    },
    {
      key: "CON",
      label: "Delivery Consistency",
      description: "How consistently creative work reaches completion without failure.",
      signals: ["step_completion_rate", "mission_failure_rate"],
    },
    {
      key: "ARC",
      label: "Narrative Cohesion",
      description: "How reliably creative output aligns with collaborators and outcomes.",
      signals: ["avg_affinity", "mission_success_rate"],
    },
  ],
  research: [
    {
      key: "EVD",
      label: "Evidence Quality",
      description: "How much validated evidence is produced and retained per mission.",
      signals: ["memory_density", "step_completion_rate"],
    },
    {
      key: "ANA",
      label: "Analytical Rigor",
      description: "How often analysis survives challenge while completing missions.",
      signals: ["challenge_rate", "mission_success_rate"],
    },
    {
      key: "SYN",
      label: "Synthesis Clarity",
      description: "How effectively research combines collaboration and evidence output.",
      signals: ["collaboration_rate", "memory_density"],
    },
    {
      key: "TRU",
      label: "Claim Trust",
      description: "How reliably research avoids bans and unnecessary escalations.",
      signals: ["ban_rate", "escalation_rate"],
    },
  ],
  operations: [
    {
      key: "REL",
      label: "Reliability",
      description: "Operational completion reliability across runs and steps.",
      signals: ["mission_success_rate", "step_completion_rate", "safety_index"],
    },
    {
      key: "LAT",
      label: "Response Tempo",
      description: "Measured step latency/throughput efficiency during operations work.",
      signals: ["step_completion_rate", "throughput_per_mission"],
    },
    {
      key: "SEC",
      label: "Security Posture",
      description: "Operational security measured by safety behavior and policy compliance.",
      signals: ["safety_index", "ban_rate"],
    },
    {
      key: "CST",
      label: "Change Stability",
      description: "Control of failure and escalation under operational pressure.",
      signals: ["escalation_rate", "mission_failure_rate"],
    },
  ],
  generalist: [
    {
      key: "BAL",
      label: "Cross-Function Balance",
      description: "Cross-functional balance between success, completion, and safety.",
      signals: ["mission_success_rate", "step_completion_rate", "safety_index"],
    },
    {
      key: "VEL",
      label: "Velocity",
      description: "General execution speed measured by completed steps per mission.",
      signals: ["throughput_per_mission"],
    },
    {
      key: "QLT",
      label: "Quality",
      description: "Outcome quality measured by low failure and low ban frequency.",
      signals: ["mission_failure_rate", "ban_rate"],
    },
    {
      key: "TRU",
      label: "Team Trust",
      description: "Team trust measured by affinity and escalation hygiene.",
      signals: ["avg_affinity", "escalation_rate"],
    },
  ],
};

type SpecialtyWeights = Record<string, number>;

const SETUP_SPECIALTY_BASE_WEIGHTS: Record<AgentSetup, SpecialtyWeights> = {
  coding: {
    mission_success_rate: 0.35,
    step_completion_rate: 0.3,
    safety_index: 0.2,
    throughput_per_mission: 0.15,
  },
  creative: {
    mission_success_rate: 0.2,
    collaboration_rate: 0.35,
    memory_density: 0.3,
    challenge_rate: 0.15,
  },
  research: {
    mission_success_rate: 0.25,
    memory_density: 0.35,
    step_completion_rate: 0.2,
    challenge_rate: 0.2,
  },
  operations: {
    mission_success_rate: 0.35,
    safety_index: 0.35,
    step_completion_rate: 0.2,
    escalation_rate: -0.1,
  },
  generalist: {
    mission_success_rate: 0.3,
    step_completion_rate: 0.25,
    collaboration_rate: 0.2,
    safety_index: 0.25,
  },
};

function storageKey(agentId: string, suffix: string): string {
  return `${STORAGE_PREFIX}:${agentId}:${suffix}`;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function parseLineArray(value: string[]): string[] {
  return value.map((v) => v.trim()).filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSetup(value: unknown): AgentSetup {
  const candidate = String(value || DEFAULT_SETUP) as AgentSetup;
  return CHARACTER_SETUPS.some((s) => s.id === candidate) ? candidate : DEFAULT_SETUP;
}

function normalizeTemperament(value: unknown): CharacterBlueprint["temperament"] {
  const candidate = String(value || "balanced") as CharacterBlueprint["temperament"];
  if (candidate === "precision" || candidate === "exploratory" || candidate === "systemic" || candidate === "balanced") {
    return candidate;
  }
  return "balanced";
}

function getSetupDefinition(setup: AgentSetup): SetupDefinition {
  switch (setup) {
    case "coding":
      return {
        setup,
        label: "Coding Specialist",
        className: "Builder",
        description: "Code-first execution with regression and safety discipline.",
        temperament: "precision",
        voiceStyle: "Technical, explicit, terse.",
        domain: "software implementation, code review, and engineering delivery",
        outputs: ["implementation plan", "patch-ready change set", "verification notes"],
        definitionOfDone: [
          "Change compiles and passes required checks.",
          "Risk and rollback notes are explicit.",
        ],
        escalation: ["Production-impacting changes", "Security-sensitive operations"],
        metrics: [
          "mission_success_rate",
          "step_completion_rate",
          "ban_rate",
          "escalation_rate",
        ],
        avatarColor: "#2563EB",
        progression: {
          stats: {
            RIG: {
              source: "mission_success_rate,step_completion_rate,ban_rate",
              formula: "clamp((mission_success_rate*0.45 + step_completion_rate*0.35 + (1-ban_rate)*0.20)*99,0,99)",
            },
            THR: {
              source: "throughput_per_mission,step_completion_rate",
              formula: "clamp(((throughput_per_mission/8)*0.55 + step_completion_rate*0.45)*99,0,99)",
            },
            SAF: {
              source: "safety_index,escalation_rate",
              formula: "clamp((safety_index*0.70 + (1-escalation_rate)*0.30)*99,0,99)",
            },
            FIT: {
              source: "mission_failure_rate,step_completion_rate,ban_rate",
              formula: "clamp(((1-mission_failure_rate)*0.45 + step_completion_rate*0.35 + (1-ban_rate)*0.20)*99,0,99)",
            },
          },
          relevantStats: ["RIG", "THR", "SAF", "FIT"],
          level: {
            maxLevel: 20,
            xpFormula: "clamp((completed_missions*1.3 + step_completed*0.08 + memory_count*0.05) / (1 + ban_triggered*0.5 + escalations*0.25),0,99)",
          },
          class: "Builder",
        },
      };
    case "creative":
      return {
        setup,
        label: "Creative Specialist",
        className: "Creator",
        description: "High-variance ideation with structure for quality.",
        temperament: "exploratory",
        voiceStyle: "Expressive, concrete, and directional.",
        domain: "creative generation, messaging, and audience-oriented output",
        outputs: ["creative brief", "multi-variant drafts", "selection rationale"],
        definitionOfDone: [
          "At least two viable creative directions are produced.",
          "Final recommendation is tied to audience and objective.",
        ],
        escalation: ["Brand-sensitive claims", "External publishing actions"],
        metrics: [
          "collaboration_rate",
          "memory_density",
          "mission_success_rate",
          "ban_rate",
        ],
        avatarColor: "#EA580C",
        progression: {
          stats: {
            CRE: {
              source: "memory_density,challenge_rate,collaboration_rate",
              formula: "clamp((memory_density*0.45 + challenge_rate*0.35 + collaboration_rate*0.20)*99,0,99)",
            },
            RES: {
              source: "collaboration_rate,mission_success_rate",
              formula: "clamp((collaboration_rate*0.60 + mission_success_rate*0.40)*99,0,99)",
            },
            CON: {
              source: "step_completion_rate,mission_failure_rate,ban_rate",
              formula: "clamp((step_completion_rate*0.45 + (1-mission_failure_rate)*0.35 + (1-ban_rate)*0.20)*99,0,99)",
            },
            ARC: {
              source: "avg_affinity,mission_success_rate",
              formula: "clamp((avg_affinity*0.50 + mission_success_rate*0.50)*99,0,99)",
            },
          },
          relevantStats: ["CRE", "RES", "CON", "ARC"],
          level: {
            maxLevel: 20,
            xpFormula: "clamp((completed_missions*1.1 + step_completed*0.06 + memory_count*0.08) / (1 + ban_triggered*0.4 + escalations*0.2),0,99)",
          },
          class: "Creator",
        },
      };
    case "research":
      return {
        setup,
        label: "Research Specialist",
        className: "Analyst",
        description: "Evidence-led reasoning and synthesis for decisions.",
        temperament: "systemic",
        voiceStyle: "Analytical, source-conscious, and explicit on uncertainty.",
        domain: "research synthesis, evidence validation, and recommendation framing",
        outputs: ["source-backed findings", "decision memo", "risk register"],
        definitionOfDone: [
          "Claims are traceable to evidence.",
          "Tradeoffs and confidence level are explicit.",
        ],
        escalation: ["Low-confidence conclusions", "Conflicting critical evidence"],
        metrics: [
          "memory_density",
          "step_completion_rate",
          "mission_success_rate",
          "escalation_rate",
        ],
        avatarColor: "#0F766E",
        progression: {
          stats: {
            EVD: {
              source: "memory_density,step_completion_rate",
              formula: "clamp((memory_density*0.65 + step_completion_rate*0.35)*99,0,99)",
            },
            ANA: {
              source: "challenge_rate,mission_success_rate",
              formula: "clamp((challenge_rate*0.40 + mission_success_rate*0.60)*99,0,99)",
            },
            SYN: {
              source: "collaboration_rate,memory_density",
              formula: "clamp((collaboration_rate*0.40 + memory_density*0.60)*99,0,99)",
            },
            TRU: {
              source: "ban_rate,escalation_rate,mission_success_rate",
              formula: "clamp(((1-ban_rate)*0.45 + (1-escalation_rate)*0.35 + mission_success_rate*0.20)*99,0,99)",
            },
          },
          relevantStats: ["EVD", "ANA", "SYN", "TRU"],
          level: {
            maxLevel: 20,
            xpFormula: "clamp((completed_missions*1.2 + step_completed*0.07 + memory_count*0.09) / (1 + ban_triggered*0.45 + escalations*0.3),0,99)",
          },
          class: "Analyst",
        },
      };
    case "operations":
      return {
        setup,
        label: "Operations Specialist",
        className: "Operator",
        description: "Reliability and policy-first operational execution.",
        temperament: "precision",
        voiceStyle: "Operational, risk-aware, and procedural.",
        domain: "operations, reliability, incident prevention, and controlled delivery",
        outputs: ["runbook update", "operational plan", "status and risk report"],
        definitionOfDone: [
          "Operational steps are explicit and reversible.",
          "Safety checks and rollback path are documented.",
        ],
        escalation: ["Destructive operations", "Security or compliance impact"],
        metrics: [
          "safety_index",
          "mission_success_rate",
          "ban_rate",
          "escalation_rate",
        ],
        avatarColor: "#1F2937",
        progression: {
          stats: {
            REL: {
              source: "mission_success_rate,step_completion_rate,safety_index",
              formula: "clamp((mission_success_rate*0.55 + step_completion_rate*0.25 + safety_index*0.20)*99,0,99)",
            },
            LAT: {
              source: "step_completion_rate,throughput_per_mission",
              formula: "clamp((step_completion_rate*0.50 + (throughput_per_mission/10)*0.50)*99,0,99)",
            },
            SEC: {
              source: "safety_index,ban_rate",
              formula: "clamp((safety_index*0.80 + (1-ban_rate)*0.20)*99,0,99)",
            },
            CST: {
              source: "escalation_rate,mission_failure_rate,ban_rate",
              formula: "clamp(((1-escalation_rate)*0.40 + (1-mission_failure_rate)*0.40 + (1-ban_rate)*0.20)*99,0,99)",
            },
          },
          relevantStats: ["REL", "LAT", "SEC", "CST"],
          level: {
            maxLevel: 20,
            xpFormula: "clamp((completed_missions*1.4 + step_completed*0.07 + memory_count*0.04) / (1 + ban_triggered*0.6 + escalations*0.35),0,99)",
          },
          class: "Operator",
        },
      };
    case "generalist":
    default:
      return {
        setup: "generalist",
        label: "Generalist",
        className: "Generalist",
        description: "Balanced execution profile for mixed workloads.",
        temperament: "balanced",
        voiceStyle: "Clear, pragmatic, and balanced.",
        domain: "cross-functional execution and coordination",
        outputs: ["plan", "execution output", "status summary"],
        definitionOfDone: [
          "Objective is completed with explicit validation.",
          "Hand-off details and risks are documented.",
        ],
        escalation: ["Unclear requirements", "High-risk operations"],
        metrics: [
          "mission_success_rate",
          "step_completion_rate",
          "safety_index",
          "collaboration_rate",
        ],
        avatarColor: "#475569",
        progression: {
          stats: {
            BAL: {
              source: "mission_success_rate,step_completion_rate,safety_index",
              formula: "clamp((mission_success_rate*0.40 + step_completion_rate*0.30 + safety_index*0.30)*99,0,99)",
            },
            VEL: {
              source: "throughput_per_mission",
              formula: "clamp((throughput_per_mission/8)*99,0,99)",
            },
            QLT: {
              source: "mission_failure_rate,ban_rate",
              formula: "clamp(((1-mission_failure_rate)*0.50 + (1-ban_rate)*0.50)*99,0,99)",
            },
            TRU: {
              source: "avg_affinity,escalation_rate,ban_rate",
              formula: "clamp((avg_affinity*0.35 + (1-escalation_rate)*0.40 + (1-ban_rate)*0.25)*99,0,99)",
            },
          },
          relevantStats: ["BAL", "VEL", "QLT", "TRU"],
          level: {
            maxLevel: 20,
            xpFormula: "clamp((completed_missions*1.2 + step_completed*0.07 + memory_count*0.06) / (1 + ban_triggered*0.45 + escalations*0.25),0,99)",
          },
          class: "Generalist",
        },
      };
  }
}

function setupHardBans(setup: AgentSetup): RoleHardBan[] {
  const base: RoleHardBan[] = [
    {
      id: "ban-data-exfiltration",
      label: "No data exfiltration",
      category: "data_exfil",
      description: "Never export or leak sensitive datasets or secrets.",
      severity: "critical",
      enforcement: "tool-block",
      triggerPhrases: ["dump db", "export all", "exfiltrate", "leak"],
    },
  ];

  if (setup === "coding" || setup === "operations") {
    base.push({
      id: "ban-unsafe-deploy",
      label: "No direct production deploy",
      category: "deploy",
      description: "Deploy actions require explicit human approval.",
      severity: "critical",
      enforcement: "tool-block",
      triggerPhrases: ["deploy", "ship to prod", "rollout production", "hotfix prod"],
    });
    base.push({
      id: "ban-destructive-delete",
      label: "No destructive file deletion",
      category: "file_delete",
      description: "Do not execute destructive file deletion commands.",
      severity: "critical",
      enforcement: "tool-block",
      triggerPhrases: ["rm -rf", "delete all", "truncate"],
    });
  }

  if (setup === "creative") {
    base.push({
      id: "ban-unverified-claims",
      label: "No unverified numerical claims",
      category: "other",
      description: "Do not invent metrics, percentages, or comparative claims.",
      severity: "warning",
      enforcement: "prompt-only",
      triggerPhrases: ["guaranteed", "best in market", "100%"],
    });
    base.push({
      id: "ban-direct-publishing",
      label: "No direct publishing",
      category: "publishing",
      description: "Publishing or posting requires human sign-off.",
      severity: "critical",
      enforcement: "tool-block",
      triggerPhrases: ["publish", "post", "tweet", "send email"],
    });
  }

  if (setup === "research") {
    base.push({
      id: "ban-unsourced-assertions",
      label: "No unsourced critical assertions",
      category: "other",
      description: "Critical claims must be tied to evidence before conclusion.",
      severity: "warning",
      enforcement: "prompt-only",
      triggerPhrases: ["definitely true", "proven"],
    });
  }

  if (setup === "generalist") {
    base.push({
      id: "ban-direct-publishing",
      label: "No direct publishing",
      category: "publishing",
      description: "External publication requires human approval.",
      severity: "critical",
      enforcement: "tool-block",
      triggerPhrases: ["publish", "post", "announce"],
    });
  }

  return base;
}

export function getSpecialtyOptions(setup: AgentSetup): string[] {
  return CHARACTER_SPECIALTY_OPTIONS[setup] || CHARACTER_SPECIALTY_OPTIONS.generalist;
}

export function getSetupStatDefinitions(setup: AgentSetup): CharacterStatDefinition[] {
  return SETUP_STAT_DEFINITIONS[setup] || SETUP_STAT_DEFINITIONS.generalist;
}

export function normalizeCharacterBlueprint(
  blueprint?: Partial<CharacterBlueprint> | null,
): CharacterBlueprint {
  const setup = normalizeSetup(blueprint?.setup);
  const specialties = parseLineArray(
    (blueprint?.specialtySkills || []).map((skill) => String(skill || "")),
  );
  const definition = getSetupDefinition(setup);

  return {
    setup,
    specialtySkills: specialties.length > 0 ? specialties : getSpecialtyOptions(setup).slice(0, 2),
    temperament: normalizeTemperament(blueprint?.temperament || definition.temperament),
  };
}

export function parseCharacterBlueprint(config: unknown): CharacterBlueprint | null {
  if (!config || typeof config !== "object") return null;
  const root = config as Record<string, unknown>;
  const candidate = (root.characterBlueprint || root.character_blueprint || root) as Record<string, unknown>;

  if (!candidate || typeof candidate !== "object") return null;
  if (!candidate.setup) return null;

  return normalizeCharacterBlueprint({
    setup: normalizeSetup(candidate.setup),
    specialtySkills: Array.isArray(candidate.specialtySkills)
      ? candidate.specialtySkills.map(String)
      : Array.isArray(candidate.specialty_skills)
      ? (candidate.specialty_skills as unknown[]).map(String)
      : [],
    temperament: normalizeTemperament(candidate.temperament),
  });
}

export function parseCharacterSeed(config: unknown): Partial<CharacterLayerConfig> | null {
  if (!config || typeof config !== "object") return null;
  const root = config as Record<string, unknown>;
  const seed = (root.characterSeed || root.character_seed) as Record<string, unknown> | undefined;
  if (!seed || typeof seed !== "object") return null;
  return seed as Partial<CharacterLayerConfig>;
}

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  const sanitized = formula.trim();
  if (!sanitized) return 0;
  if (!/^[0-9a-zA-Z_+\-*/().,\s]*$/.test(sanitized)) {
    throw new Error(`Illegal tokens in formula: ${sanitized}`);
  }
  const names = Object.keys(variables);
  const values = Object.values(variables);
  const fn = new Function(
    ...names,
    "clamp",
    "log2",
    `return (${sanitized});`,
  ) as (...args: any[]) => number;
  return Number(fn(...values, clamp, Math.log2));
}

function defaultIdentity(blueprint?: Partial<CharacterBlueprint> | null): CharacterLayerConfig["identity"] {
  const normalized = normalizeCharacterBlueprint(blueprint);
  const definition = getSetupDefinition(normalized.setup);
  return {
    setup: normalized.setup,
    className: definition.className,
    specialtySkills: normalized.specialtySkills,
    temperament: normalized.temperament,
  };
}

function defaultRoleCard(
  agentId: string,
  name: string,
  identity: CharacterLayerConfig["identity"],
): RoleCardConfig {
  const definition = getSetupDefinition(identity.setup);
  const specialties = identity.specialtySkills.length
    ? ` Specialties: ${identity.specialtySkills.join(", ")}.`
    : "";

  return {
    agentId,
    domain: `${name} owns ${definition.domain}.${specialties}`,
    inputs: ["WIH prompt", "upstream artifacts", "mission context"],
    outputs: definition.outputs,
    definitionOfDone: definition.definitionOfDone,
    hardBans: setupHardBans(identity.setup),
    escalation: definition.escalation,
    metrics: definition.metrics,
  };
}

function defaultVoice(identity: CharacterLayerConfig["identity"]): CharacterLayerConfig["voice"] {
  const definition = getSetupDefinition(identity.setup);
  return {
    style: definition.voiceStyle,
    rules: [
      "Every response must contain one concrete fact and one recommended action.",
      "When confidence is low, state uncertainty explicitly and escalate.",
    ],
    microBans: [
      "No filler acknowledgements.",
      "No fabricated metrics or unverifiable claims.",
    ],
    conflictBias: {
      prefersChallengeWith: [],
    },
  };
}

function defaultRelationships(): RelationshipConfig {
  return {
    defaults: {
      affinityFloor: 0.1,
      affinityCeiling: 0.95,
    },
    pairs: [],
  };
}

function defaultProgression(identity: CharacterLayerConfig["identity"]): CharacterLayerConfig["progression"] {
  const definition = getSetupDefinition(identity.setup);
  return {
    ...definition.progression,
    class: identity.className || definition.className,
  };
}

function defaultAvatar(identity: CharacterLayerConfig["identity"]): AvatarConfig {
  const definition = getSetupDefinition(identity.setup);
  return {
    type: "color",
    fallbackColor: definition.avatarColor,
  };
}

export function getDefaultCharacterLayer(
  agentId: string,
  name: string,
  blueprint?: Partial<CharacterBlueprint> | null,
): CharacterLayerConfig {
  const identity = defaultIdentity(blueprint);
  return {
    identity,
    roleCard: defaultRoleCard(agentId, name, identity),
    voice: defaultVoice(identity),
    relationships: defaultRelationships(),
    progression: defaultProgression(identity),
    avatar: defaultAvatar(identity),
  };
}

export function loadCharacterLayer(
  agentId: string,
  name: string,
  blueprint?: Partial<CharacterBlueprint> | null,
  seed?: Partial<CharacterLayerConfig> | null,
): CharacterLayerConfig {
  const fallback = seed
    ? normalizeCharacterLayer(seed, agentId, name, blueprint)
    : getDefaultCharacterLayer(agentId, name, blueprint);
  if (typeof localStorage === "undefined") {
    return fallback;
  }
  const key = storageKey(agentId, "config");
  const loaded = safeJsonParse<Partial<CharacterLayerConfig>>(localStorage.getItem(key), fallback);
  return normalizeCharacterLayer(loaded, agentId, name, blueprint);
}

export function saveCharacterLayer(agentId: string, config: CharacterLayerConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(agentId, "config"), JSON.stringify(config));
}

export function loadTelemetryEvents(agentId: string): CharacterTelemetryEvent[] {
  if (typeof localStorage === "undefined") return [];
  return safeJsonParse<CharacterTelemetryEvent[]>(
    localStorage.getItem(storageKey(agentId, "telemetry")),
    [],
  );
}

export function appendTelemetryEvent(agentId: string, event: CharacterTelemetryEvent): CharacterTelemetryEvent[] {
  const events = loadTelemetryEvents(agentId);
  const next = [...events, event].slice(-MAX_TELEMETRY_EVENTS);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(agentId, "telemetry"), JSON.stringify(next));
  }
  return next;
}

export function deriveVoiceModifiers(events: CharacterTelemetryEvent[]): string[] {
  const memoryByType: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== "memory_written") continue;
    const bucket = String(event.payload.memory_type || "generic");
    memoryByType[bucket] = (memoryByType[bucket] || 0) + 1;
  }
  const modifiers: string[] = [];
  if ((memoryByType.lesson || 0) >= 8) {
    modifiers.push("You reference outcomes and avoid repeating mistakes.");
  }
  if ((memoryByType.strategy || 0) >= 8) {
    modifiers.push("You think in constraints and explicit tradeoffs.");
  }
  const topBucket = Object.entries(memoryByType).sort((a, b) => b[1] - a[1])[0];
  if (topBucket && topBucket[1] >= 4) {
    modifiers.push(`You show strong expertise in ${topBucket[0]}.`);
  }
  return modifiers.slice(0, 3);
}

function buildPromptBlocks(config: CharacterLayerConfig, modifiers: string[]): CharacterCompiledConfig["promptBlocks"] {
  const role = [
    `Setup: ${config.identity.setup}`,
    `Class: ${config.identity.className}`,
    `Specialties: ${config.identity.specialtySkills.join(", ") || "none"}`,
    `Temperament: ${config.identity.temperament}`,
    `Domain: ${config.roleCard.domain}`,
    `Inputs: ${config.roleCard.inputs.join("; ")}`,
    `Outputs: ${config.roleCard.outputs.join("; ")}`,
    `Definition of Done: ${config.roleCard.definitionOfDone.join("; ")}`,
  ].join("\n");

  const bans = [
    "Hard Bans:",
    ...config.roleCard.hardBans.map(
      (ban) => `- [${ban.severity}] ${ban.label} (${ban.category}) :: ${ban.description}`,
    ),
    "Escalation:",
    ...config.roleCard.escalation.map((e) => `- ${e}`),
  ].join("\n");

  const voice = [
    `Style: ${config.voice.style}`,
    "Rules:",
    ...config.voice.rules.map((r) => `- ${r}`),
    "Micro bans:",
    ...config.voice.microBans.map((r) => `- ${r}`),
  ].join("\n");

  return {
    role,
    bans,
    voice,
    modifiers: modifiers.map((m) => `- ${m}`).join("\n"),
  };
}

function formulaProbeContext(): Record<string, number> {
  return {
    x: 0.5,
    success: 0.7,
    affinity: 0.5,
    throughput: 6,
    memory_count: 8,
    completed_missions: 4,
    mission_success_rate: 0.7,
    mission_failure_rate: 0.2,
    step_completion_rate: 0.8,
    throughput_per_mission: 3,
    memory_density: 1.5,
    ban_rate: 0.1,
    escalation_rate: 0.15,
    safety_index: 0.85,
    collaboration_rate: 0.6,
    challenge_rate: 0.4,
    avg_affinity: 0.55,
    total_missions: 6,
    step_started: 20,
    step_completed: 16,
    ban_triggered: 1,
    escalations: 1,
  };
}

function compileLint(config: CharacterLayerConfig): CharacterLintIssue[] {
  const issues: CharacterLintIssue[] = [];
  if (!config.roleCard.domain.trim()) {
    issues.push({ level: "error", code: "ROLE_DOMAIN_EMPTY", message: "Role card domain is required." });
  }
  if (config.roleCard.inputs.length === 0 || config.roleCard.outputs.length === 0) {
    issues.push({ level: "error", code: "ROLE_IO_MISSING", message: "Role card requires at least one input and output." });
  }
  if (config.roleCard.definitionOfDone.length === 0) {
    issues.push({ level: "error", code: "ROLE_DOD_EMPTY", message: "Definition of Done must include at least one item." });
  }
  if (config.identity.specialtySkills.length === 0) {
    issues.push({ level: "warning", code: "IDENTITY_SPECIALTIES_EMPTY", message: "No specialty skills selected; role specificity is weak." });
  }
  if (config.roleCard.hardBans.length === 0) {
    issues.push({ level: "warning", code: "ROLE_BANS_EMPTY", message: "No hard bans defined; blast radius may be too large." });
  }
  const floor = config.relationships.defaults.affinityFloor;
  const ceil = config.relationships.defaults.affinityCeiling;
  if (floor >= ceil) {
    issues.push({ level: "error", code: "RELATIONSHIP_RANGE_INVALID", message: "Affinity floor must be lower than affinity ceiling." });
  }
  const probe = formulaProbeContext();
  for (const [name, stat] of Object.entries(config.progression.stats)) {
    try {
      evaluateFormula(stat.formula, probe);
    } catch {
      issues.push({ level: "error", code: `FORMULA_INVALID_${name}`, message: `Stat formula for ${name} is invalid.` });
    }
  }
  try {
    evaluateFormula(config.progression.level.xpFormula, probe);
  } catch {
    issues.push({ level: "error", code: "XP_FORMULA_INVALID", message: "Level XP formula is invalid." });
  }
  return issues;
}

function yamlString(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    if (/^[a-zA-Z0-9_.:/# -]+$/.test(value)) return value;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const rendered = yamlString(item, indent + 1);
        if (typeof item === "object" && item !== null) {
          const lines = rendered.split("\n");
          return `${pad}- ${lines[0]}\n${lines.slice(1).map((l) => `${pad}  ${l}`).join("\n")}`;
        }
        return `${pad}- ${rendered}`;
      })
      .join("\n");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([key, val]) => {
      const rendered = yamlString(val, indent + 1);
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        return `${pad}${key}:\n${rendered}`;
      }
      if (Array.isArray(val) && val.length > 0) {
        return `${pad}${key}:\n${rendered}`;
      }
      return `${pad}${key}: ${rendered}`;
    })
    .join("\n");
}

export function buildCharacterArtifacts(
  agentId: string,
  config: CharacterLayerConfig,
  compiled: CharacterCompiledConfig,
): CharacterArtifactFile[] {
  const base = `/agents/${toSlug(agentId)}`;
  return [
    { path: `${base}/identity.yaml`, content: yamlString(config.identity) },
    { path: `${base}/role_card.yaml`, content: yamlString(config.roleCard) },
    { path: `${base}/voice.yaml`, content: yamlString(config.voice) },
    { path: `${base}/relationships.yaml`, content: yamlString(config.relationships) },
    { path: `${base}/progression.yaml`, content: yamlString(config.progression) },
    { path: `${base}/avatar.json`, content: JSON.stringify(config.avatar, null, 2) },
    { path: `${base}/compiled.json`, content: JSON.stringify(compiled, null, 2) },
  ];
}

export function compileCharacterLayer(
  agentId: string,
  config: CharacterLayerConfig,
  events: CharacterTelemetryEvent[],
): { compiled: CharacterCompiledConfig; artifacts: CharacterArtifactFile[] } {
  const modifiers = deriveVoiceModifiers(events);
  const lint = compileLint(config);
  const promptBlocks = buildPromptBlocks(config, modifiers);
  const hash = stableHash(JSON.stringify({ config, promptBlocks }));
  const compiled: CharacterCompiledConfig = {
    agentId,
    compiledAt: new Date().toISOString(),
    hash,
    promptBlocks,
    hardBans: config.roleCard.hardBans,
    escalationRules: config.roleCard.escalation,
    lint,
  };
  const artifacts = buildCharacterArtifacts(agentId, config, compiled);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(agentId, "compiled"), JSON.stringify(compiled));
    localStorage.setItem(storageKey(agentId, "artifacts"), JSON.stringify(artifacts));
  }
  return { compiled, artifacts };
}

export function loadCompiledCharacterLayer(agentId: string): CharacterCompiledConfig | null {
  if (typeof localStorage === "undefined") return null;
  return safeJsonParse<CharacterCompiledConfig | null>(
    localStorage.getItem(storageKey(agentId, "compiled")),
    null,
  );
}

export function loadCharacterArtifacts(agentId: string): CharacterArtifactFile[] {
  if (typeof localStorage === "undefined") return [];
  return safeJsonParse<CharacterArtifactFile[]>(
    localStorage.getItem(storageKey(agentId, "artifacts")),
    [],
  );
}

const CATEGORY_KEYWORDS: Record<HardBanCategory, string[]> = {
  publishing: ["publish", "post", "tweet", "announce", "broadcast"],
  deploy: ["deploy", "production", "rollout", "release"],
  data_exfil: ["export all", "dump db", "exfiltrate", "leak"],
  payments: ["pay", "wire", "invoice", "charge card"],
  email_send: ["send email", "email blast", "mail merge"],
  file_delete: ["delete file", "rm -rf", "truncate"],
  other: [],
};

export function detectBanViolation(input: string, bans: RoleHardBan[]): BanViolation | null {
  const normalized = input.toLowerCase();
  for (const ban of bans) {
    if (ban.enforcement !== "tool-block") continue;
    const keywords = [...CATEGORY_KEYWORDS[ban.category], ...ban.triggerPhrases.map((p) => p.toLowerCase())];
    if (keywords.some((k) => k && normalized.includes(k.toLowerCase()))) {
      return {
        banId: ban.id,
        label: ban.label,
        category: ban.category,
        reason: `Matched hard ban keyword for ${ban.category}.`,
        severity: ban.severity,
      };
    }
  }
  return null;
}

function buildTelemetryContext(
  config: CharacterLayerConfig,
  events: CharacterTelemetryEvent[],
): Record<string, number> {
  const totalMissions = events.filter((e) => e.type === "mission_created").length;
  const completedMissions = events.filter((e) => e.type === "mission_completed").length;
  const failedMissions = events.filter((e) => e.type === "mission_failed").length;
  const stepStarted = events.filter((e) => e.type === "step_started").length;
  const stepCompleted = events.filter((e) => e.type === "step_completed").length;
  const memoryCount = events.filter((e) => e.type === "memory_written").length;
  const banTriggered = events.filter((e) => e.type === "ban_triggered").length;
  const escalations = events.filter((e) => e.type === "escalation_requested").length;
  const interactionEvents = events.filter((e) => e.type === "interaction");

  const challengeInteractions = interactionEvents.filter((e) => e.payload.interaction_type === "challenge").length;
  const handoffSuccess = interactionEvents.filter((e) => e.payload.interaction_type === "handoff_success").length;

  const avgAffinity = clamp(
    config.relationships.pairs.length
      ? config.relationships.pairs.reduce((sum, p) => sum + p.affinity, 0) / config.relationships.pairs.length
      : 0.5,
    0.1,
    0.95,
  );

  const missionSuccessRate = totalMissions > 0 ? completedMissions / totalMissions : 0;
  const missionFailureRate = totalMissions > 0 ? failedMissions / totalMissions : 0;
  const stepCompletionRate = stepStarted > 0 ? stepCompleted / stepStarted : 0;
  const throughputPerMission = stepCompleted / Math.max(1, totalMissions);
  const memoryDensity = memoryCount / Math.max(1, totalMissions);
  const banRate = banTriggered / Math.max(1, totalMissions);
  const escalationRate = escalations / Math.max(1, totalMissions);
  const interactionTotal = Math.max(1, interactionEvents.length);
  const collaborationRate = handoffSuccess / interactionTotal;
  const challengeRate = challengeInteractions / interactionTotal;
  const safetyIndex = clamp(1 - (banRate * 0.6 + escalationRate * 0.4), 0, 1);

  return {
    x: collaborationRate,
    success: missionSuccessRate,
    affinity: avgAffinity,
    throughput: stepCompleted,
    memory_count: memoryCount,
    completed_missions: completedMissions,
    mission_success_rate: missionSuccessRate,
    mission_failure_rate: missionFailureRate,
    step_completion_rate: stepCompletionRate,
    throughput_per_mission: throughputPerMission,
    memory_density: memoryDensity,
    ban_rate: banRate,
    escalation_rate: escalationRate,
    safety_index: safetyIndex,
    collaboration_rate: collaborationRate,
    challenge_rate: challengeRate,
    avg_affinity: avgAffinity,
    total_missions: totalMissions,
    step_started: stepStarted,
    step_completed: stepCompleted,
    ban_triggered: banTriggered,
    escalations,
  };
}

function normalizeContextValue(metric: string, value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (metric === "throughput_per_mission" || metric === "throughput") {
    return clamp(value / 8, 0, 1);
  }
  if (metric === "memory_density") {
    return clamp(value / 3, 0, 1);
  }
  if (
    metric === "memory_count" ||
    metric === "completed_missions" ||
    metric === "step_started" ||
    metric === "step_completed" ||
    metric === "total_missions" ||
    metric === "ban_triggered" ||
    metric === "escalations"
  ) {
    return clamp(value / 20, 0, 1);
  }
  return clamp(value, 0, 1);
}

function overlayWeights(base: SpecialtyWeights, updates: SpecialtyWeights): SpecialtyWeights {
  return { ...base, ...updates };
}

function specialtyWeightsForSkill(setup: AgentSetup, skill: string): SpecialtyWeights {
  let weights = { ...(SETUP_SPECIALTY_BASE_WEIGHTS[setup] || SETUP_SPECIALTY_BASE_WEIGHTS.generalist) };
  const normalizedSkill = skill.toLowerCase();

  if (/security|safety|policy|hardening/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      safety_index: 0.45,
      ban_rate: -0.25,
      escalation_rate: -0.15,
    });
  }
  if (/performance|latency|speed|throughput/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      throughput_per_mission: 0.5,
      step_completion_rate: 0.3,
      mission_success_rate: 0.2,
    });
  }
  if (/debug|testing|quality|reliability|refactor/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      step_completion_rate: 0.35,
      mission_success_rate: 0.35,
      mission_failure_rate: -0.3,
    });
  }
  if (/story|brand|campaign|copy|visual|creative|community/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      collaboration_rate: 0.35,
      memory_density: 0.3,
      challenge_rate: 0.25,
      mission_success_rate: 0.1,
    });
  }
  if (/analysis|research|synthesis|validation|data|risk|memo/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      memory_density: 0.35,
      challenge_rate: 0.25,
      step_completion_rate: 0.2,
      mission_success_rate: 0.2,
    });
  }
  if (/incident|runbook|deployment|operations|cost/.test(normalizedSkill)) {
    weights = overlayWeights(weights, {
      safety_index: 0.4,
      mission_success_rate: 0.3,
      escalation_rate: -0.2,
      ban_rate: -0.1,
    });
  }

  return weights;
}

function scoreSpecialty(
  setup: AgentSetup,
  skill: string,
  context: Record<string, number>,
): number {
  const weights = specialtyWeightsForSkill(setup, skill);
  let weightedScore = 0;
  let weightTotal = 0;

  for (const [metric, weight] of Object.entries(weights)) {
    const raw = context[metric] ?? 0;
    const normalizedValue = normalizeContextValue(metric, raw);
    if (weight >= 0) {
      weightedScore += normalizedValue * weight;
    } else {
      weightedScore += (1 - normalizedValue) * Math.abs(weight);
    }
    weightTotal += Math.abs(weight);
  }

  if (weightTotal === 0) return 0;
  return Math.round(clamp((weightedScore / weightTotal) * 99, 0, 99));
}

function buildSpecialtyScores(
  config: CharacterLayerConfig,
  context: Record<string, number>,
): Record<string, number> {
  const specialties = config.identity.specialtySkills || [];
  const scores: Record<string, number> = {};
  for (const skill of specialties) {
    scores[skill] = scoreSpecialty(config.identity.setup, skill, context);
  }
  return scores;
}

export function computeCharacterStats(
  config: CharacterLayerConfig,
  events: CharacterTelemetryEvent[],
): CharacterStats {
  const context = buildTelemetryContext(config, events);
  const statDefinitions = getSetupStatDefinitions(config.identity.setup).filter(
    (definition) => Boolean(config.progression.stats[definition.key]),
  );

  const stats: Record<string, number> = {};
  for (const [key, rule] of Object.entries(config.progression.stats)) {
    try {
      const value = evaluateFormula(rule.formula, context);
      stats[key] = Math.round(clamp(value, 0, 99));
    } catch {
      stats[key] = 0;
    }
  }

  let xp = 0;
  try {
    xp = Math.max(0, evaluateFormula(config.progression.level.xpFormula, context));
  } catch {
    xp = 0;
  }
  const unclampedLevel = Math.floor(xp) + 1;
  const level = clamp(unclampedLevel, 1, config.progression.level.maxLevel);

  return {
    level,
    xp,
    class: config.progression.class,
    stats,
    relevantStats: config.progression.relevantStats,
    statDefinitions,
    specialtyScores: buildSpecialtyScores(config, context),
  };
}

export function applyRelationshipDrift(
  config: RelationshipConfig,
  interactions: Array<{ agentA: string; agentB: string; interactionType: string }>,
): RelationshipConfig {
  const nextPairs = [...config.pairs];
  const floor = config.defaults.affinityFloor;
  const ceiling = config.defaults.affinityCeiling;

  for (const interaction of interactions) {
    const idx = nextPairs.findIndex(
      (pair) =>
        (pair.agentA === interaction.agentA && pair.agentB === interaction.agentB) ||
        (pair.agentA === interaction.agentB && pair.agentB === interaction.agentA),
    );
    if (idx < 0) continue;

    const drift =
      interaction.interactionType === "challenge"
        ? -0.02
        : interaction.interactionType === "ban_triggered"
        ? -0.03
        : interaction.interactionType === "handoff_success"
        ? 0.02
        : 0;
    nextPairs[idx] = {
      ...nextPairs[idx],
      affinity: clamp(nextPairs[idx].affinity + drift, floor, ceiling),
    };
  }

  return {
    ...config,
    pairs: nextPairs,
  };
}

function normalizeCharacterLayer(
  config: Partial<CharacterLayerConfig>,
  agentId: string,
  name: string,
  blueprint?: Partial<CharacterBlueprint> | null,
): CharacterLayerConfig {
  const fallback = getDefaultCharacterLayer(agentId, name, blueprint);
  const normalizedIdentity = {
    ...fallback.identity,
    ...(config.identity || {}),
    setup: normalizeSetup(config.identity?.setup || fallback.identity.setup),
    temperament: normalizeTemperament(config.identity?.temperament || fallback.identity.temperament),
    specialtySkills: parseLineArray(config.identity?.specialtySkills || fallback.identity.specialtySkills),
  };

  const setupFallback = getDefaultCharacterLayer(agentId, name, normalizedIdentity);

  return {
    identity: {
      ...setupFallback.identity,
      ...normalizedIdentity,
      className: config.identity?.className || setupFallback.identity.className,
      specialtySkills: normalizedIdentity.specialtySkills.length
        ? normalizedIdentity.specialtySkills
        : setupFallback.identity.specialtySkills,
    },
    roleCard: {
      ...setupFallback.roleCard,
      ...(config.roleCard || {}),
      agentId,
      inputs: parseLineArray(config.roleCard?.inputs || setupFallback.roleCard.inputs),
      outputs: parseLineArray(config.roleCard?.outputs || setupFallback.roleCard.outputs),
      definitionOfDone: parseLineArray(config.roleCard?.definitionOfDone || setupFallback.roleCard.definitionOfDone),
      escalation: parseLineArray(config.roleCard?.escalation || setupFallback.roleCard.escalation),
      metrics: parseLineArray(config.roleCard?.metrics || setupFallback.roleCard.metrics),
      hardBans: (config.roleCard?.hardBans || setupFallback.roleCard.hardBans).map((ban, idx) => ({
        ...ban,
        id: ban.id || `ban-${idx + 1}`,
        triggerPhrases: parseLineArray(ban.triggerPhrases || []),
      })),
    },
    voice: {
      ...setupFallback.voice,
      ...(config.voice || {}),
      rules: parseLineArray(config.voice?.rules || setupFallback.voice.rules),
      microBans: parseLineArray(config.voice?.microBans || setupFallback.voice.microBans),
      conflictBias: {
        prefersChallengeWith: parseLineArray(
          config.voice?.conflictBias?.prefersChallengeWith || setupFallback.voice.conflictBias.prefersChallengeWith,
        ),
      },
    },
    relationships: {
      defaults: {
        affinityFloor: Number(config.relationships?.defaults?.affinityFloor ?? setupFallback.relationships.defaults.affinityFloor),
        affinityCeiling: Number(config.relationships?.defaults?.affinityCeiling ?? setupFallback.relationships.defaults.affinityCeiling),
      },
      pairs: (config.relationships?.pairs || setupFallback.relationships.pairs).map((pair) => ({
        ...pair,
        affinity: clamp(Number(pair.affinity), 0.1, 0.95),
      })),
    },
    progression: {
      ...setupFallback.progression,
      ...(config.progression || {}),
      stats: {
        ...setupFallback.progression.stats,
        ...(config.progression?.stats || {}),
      },
      relevantStats: parseLineArray(config.progression?.relevantStats || setupFallback.progression.relevantStats),
      level: {
        maxLevel: Number(config.progression?.level?.maxLevel ?? setupFallback.progression.level.maxLevel),
        xpFormula: config.progression?.level?.xpFormula || setupFallback.progression.level.xpFormula,
      },
      class:
        config.progression?.class ||
        config.identity?.className ||
        setupFallback.progression.class,
    },
    avatar: {
      ...setupFallback.avatar,
      ...(config.avatar || {}),
    },
  };
}
