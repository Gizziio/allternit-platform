/**
 * Create Bot wizard — all user-facing strings in one place.
 *
 * Register 1 voice: plain, direct, no hype adjectives, no guarantee language
 * (see Allternit Brain/company/voice.md).
 */

export const WIZARD_COPY = {
  header: {
    brandMark: "A://",
    title: "Create bot",
    closeLabel: "Close",
  },
  steps: {
    start: {
      label: "Start",
      railHint: "Pick a starting point",
      title: "Start with a template",
      description:
        "Templates arrive pre-filled with a real job description, tools, and starter prompts. Pick one and edit it, or start blank.",
      blankCardLabel: "Blank",
      blankCardDescription: "Start from scratch with zero-config defaults.",
      describeToggle: "Describe the bot you want",
      describeDescription:
        "One sentence is enough. We pre-fill the steps from it — you keep clicking through to adjust.",
      describePlaceholder: "e.g. A bot that checks our competitors' pricing every morning and sends me a summary…",
      describeAction: "Prefill",
      describeWorking: "Working…",
    },
    identity: {
      label: "Identity",
      railHint: "Name, look, and personality",
      title: "Name your bot",
      description:
        "The name is the only requirement. Everything else gives the bot a face and a first message.",
      displayNameLabel: "Display name",
      displayNamePlaceholder: "e.g. Quinn — Chief of Staff",
      displayNameHint: "Use the format Name — Role.",
      nameTooShort: "Add a display name (at least 2 characters) to continue.",
      handleLabel: "Handle",
      handlePlaceholder: "research-assistant",
      taglineLabel: "Tagline",
      taglinePlaceholder: "Short description shown on the bot card",
      categoryLabel: "Category",
      purposeLabel: "Purpose / description",
      purposePlaceholder: "What does this bot do?",
      welcomeLabel: "Welcome message",
      welcomePlaceholder: "Hi! I'm your new bot. How can I help?",
      accentLabel: "Accent color",
      starterPromptsLabel: "Starter prompts",
      starterPromptsPlaceholder: "Add quick-start prompts users can click…",
      starterPromptsHint: "Max 5 starter prompts.",
      avatarTitle: "Avatar",
      avatarDescription: "Choose a visual identity for your bot. Gizzi is the default companion.",
    },
    job: {
      label: "Job",
      railHint: "Instructions and tools",
      title: "Job & Tools",
      description:
        "What this bot does, and what it is allowed to use. Saved with the bot when you create it.",
      systemPromptLabel: "Job instructions",
      refineAction: "Refine from my description",
      refineWorking: "Working…",
      systemPromptPlaceholder: "Your job: …\n\nYou do:\n- …\n\nYou do not:\n- …",
      systemPromptHint:
        "This becomes the bot's system prompt. State the job plainly — what it does and what it does not do. Optional: the platform adds identity and computer context at runtime.",
      toolsLabel: "Tools",
    },
    computer: {
      label: "Computer & Runtime",
      railHint: "Desktop, model, and voice",
      title: "Computer & Runtime",
      description:
        "Your bot gets its own always-on desktop in Computer Cloud. Files, tools, and browser state persist between sessions.",
      desktopToggleLabel: "Persistent desktop",
      desktopToggleDescription:
        "Provisioned when you create the bot, bound to it by id. The same computer is reused every time you open the bot.",
      desktopSizeLabel: "Size",
      desktopProviderLabel: "Provider",
      desktopProviderValue: "Computer Cloud · Incus Linux desktop",
      desktopResourcesLabel: "Resources",
      desktopPersistenceLabel: "Persistence",
      desktopPersistenceValue: "Persistent — survives across sessions",
      desktopNote:
        "The desktop starts provisioning when you hit Create bot. You can watch its status here and on the bot card.",
      intelligenceTitle: "Intelligence",
      intelligenceDescription:
        "Pre-selected with sensible defaults — change anything here, or leave it as is.",
      knowledgeBrainLabel: "Gizzi knowledge",
      noBrains: "No Gizzi knowledge brains found. Select a platform model below.",
      brainLabel: "Brain",
      modelLabel: "Model",
      providerLabel: "Provider",
      harnessLabel: "Harness",
      advancedTitle: "Advanced",
      maxIterationsLabel: "Max iterations",
      temperatureLabel: "Temperature",
      voiceTitle: "Voice",
      voiceToggleLabel: "Enable voice",
      voiceToggleDescription: "Speak responses with text-to-speech.",
      voiceDefault: "Default voice",
      voiceLoading: "Loading voices…",
      voiceSelect: "Select voice",
      createCta: "Create bot",
      creatingCta: "Creating…",
      createDisabledHint: "Finish the required fields to create",
    },
  },
  footer: {
    back: "Back",
    next: "Next",
    cancel: "Cancel",
    stepCounter: (current: number, total: number) => `Step ${current} of ${total}`,
  },
  preview: {
    title: "Live preview",
    summaryTitle: "Summary",
    summaryHandle: "Handle",
    summaryCategory: "Category",
    summaryToolsLabel: "Tools",
    summaryTools: (count: number) => (count === 0 ? "No tools" : `${count} tool${count === 1 ? "" : "s"}`),
    summaryComputer: "Computer",
    summaryComputerOn: "Always-on desktop",
    summaryComputerOff: "No desktop",
    summaryModel: "Model",
    summaryBrain: "Brain",
    untitledBot: "Untitled bot",
  },
  provisioning: {
    creatingTitle: "Creating your bot…",
    title: "Provisioning your bot's desktop…",
    runningTitle: "Your bot's desktop is running",
    description:
      "Your bot gets its own always-on desktop. It is being set up now; you will land on the bot's home when it is ready.",
    retry: "Retry",
    errorPrefix: "The desktop could not be provisioned",
    proceedNote: "Taking longer than expected — opening the bot home anyway.",
    openHome: "Open bot home",
  },
  errors: {
    imageTooLarge: "Image too large (max 15MB).",
    imageReadFailed: "Failed to read image.",
    createFailed: "Failed to create bot.",
    checklistPrefix: "Still missing",
  },
} as const;

export type WizardCopy = typeof WIZARD_COPY;
