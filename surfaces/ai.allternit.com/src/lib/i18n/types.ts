/**
 * Internationalization (i18n) Types and Interfaces
 *
 * Type definitions for the i18n system supporting the Agent Creation Wizard
 * and other platform components.
 *
 * @module i18n/types
 * @version 1.0.0
 */

/**
 * Supported language codes
 * Add new languages here as they become available
 */
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt' | 'ko';

/**
 * Language metadata for display in selectors
 */
export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  enabled: boolean;
}

/**
 * Translation resource structure
 */
export interface TranslationResource {
  [key: string]: string | TranslationResource;
}

/**
 * Main translation structure for the platform
 */
export interface Translations {
  // Common UI elements
  common: {
    save: string;
    cancel: string;
    close: string;
    next: string;
    back: string;
    loading: string;
    error: string;
    success: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    confirm: string;
    search: string;
    filter: string;
    reset: string;
    done: string;
    retry: string;
    skip: string;
    finish: string;
  };

  // Wizard navigation
  wizard: {
    step: string;
    of: string;
    progress: string;
    draftSaved: string;
    draftSavedAt: string;
    unsavedChanges: string;
    leaveConfirmation: string;
    stay: string;
    leave: string;
  };

  // Wizard steps
  steps: {
    identity: {
      title: string;
      description: string;
      name: string;
      namePlaceholder: string;
      nameHint: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      descriptionHint: string;
      type: string;
      typeHint: string;
      model: string;
      modelHint: string;
      loadingModels: string;
    };
    character: {
      title: string;
      description: string;
      specialization: string;
      specializationHint: string;
      skills: string;
      skillsPlaceholder: string;
      skillsHint: string;
      temperament: string;
      temperamentHint: string;
      personalityTraits: string;
      personalityPlaceholder: string;
      backstory: string;
      backstoryPlaceholder: string;
    };
    avatar: {
      title: string;
      description: string;
      type: string;
      template: string;
      colorScheme: string;
      primaryColor: string;
      accentColor: string;
      preview: string;
      selectAvatar: string;
      category: string;
    };
    role: {
      title: string;
      description: string;
      domain: string;
      domainPlaceholder: string;
      inputs: string;
      outputs: string;
      definitionOfDone: string;
      hardBans: string;
      hardBansHint: string;
      escalation: string;
      escalationHint: string;
      metrics: string;
      addBan: string;
      selectCategory: string;
      severity: string;
      fatal: string;
      warning: string;
      info: string;
    };
    voice: {
      title: string;
      description: string;
      style: string;
      styleHint: string;
      rules: string;
      rulesPlaceholder: string;
      microBans: string;
      microBansPlaceholder: string;
      tone: string;
      formality: string;
      enthusiasm: string;
      empathy: string;
      directness: string;
      conflictBias: string;
      prefersChallenge: string;
      avoidsConflict: string;
    };
    advanced: {
      title: string;
      description: string;
      relationships: string;
      initialAffinity: string;
      trustCurve: string;
      linear: string;
      exponential: string;
      logarithmic: string;
      relevantStats: string;
      capabilities: string;
      capabilitiesPlaceholder: string;
    };
    tools: {
      title: string;
      description: string;
      availableTools: string;
      systemPrompt: string;
      temperature: string;
      temperatureHint: string;
      maxIterations: string;
      maxIterationsHint: string;
      categories: {
        execution: string;
        filesystem: string;
        network: string;
        code: string;
        communication: string;
        other: string;
      };
    };
    plugins: {
      title: string;
      description: string;
      browseCategories: string;
      availablePlugins: string;
      official: string;
      verified: string;
      install: string;
      installed: string;
      configure: string;
      permissions: string;
    };
    workspace: {
      title: string;
      description: string;
      files: string;
      identityFile: string;
      roleCardFile: string;
      voiceFile: string;
      capabilitiesFile: string;
      avatarFile: string;
      compiledFile: string;
      editFile: string;
      previewFile: string;
      fileHint: string;
    };
    review: {
      title: string;
      description: string;
      summary: string;
      identity: string;
      character: string;
      role: string;
      voice: string;
      tools: string;
      plugins: string;
      createAgent: string;
      readyMessage: string;
      editSection: string;
    };
  };

  // Agent types
  agentTypes: {
    orchestrator: string;
    orchestratorDesc: string;
    specialist: string;
    specialistDesc: string;
    worker: string;
    workerDesc: string;
    reviewer: string;
    reviewerDesc: string;
    subAgent: string;
    subAgentDesc: string;
  };

  // Agent setups
  agentSetups: {
    coding: string;
    codingDesc: string;
    creative: string;
    creativeDesc: string;
    research: string;
    researchDesc: string;
    operations: string;
    operationsDesc: string;
    generalist: string;
    generalistDesc: string;
  };

  // Temperaments
  temperaments: {
    precision: string;
    precisionDesc: string;
    exploratory: string;
    exploratoryDesc: string;
    systemic: string;
    systemicDesc: string;
    balanced: string;
    balancedDesc: string;
  };

  // Voice styles
  voiceStyles: {
    professional: string;
    casual: string;
    enthusiastic: string;
    analytical: string;
    empathetic: string;
    witty: string;
    direct: string;
    teaching: string;
  };

  // Mascot templates
  mascotTemplates: {
    gizzi: string;
    gizziDesc: string;
    bot: string;
    botDesc: string;
    orb: string;
    orbDesc: string;
    creature: string;
    creatureDesc: string;
    geometric: string;
    geometricDesc: string;
    minimal: string;
    minimalDesc: string;
  };

  // Hard ban categories
  hardBans: {
    publishing: string;
    publishingDesc: string;
    deploy: string;
    deployDesc: string;
    dataExfil: string;
    dataExfilDesc: string;
    payments: string;
    paymentsDesc: string;
    emailSend: string;
    emailSendDesc: string;
    fileDelete: string;
    fileDeleteDesc: string;
    systemModify: string;
    systemModifyDesc: string;
    externalCommunication: string;
    externalCommunicationDesc: string;
    codeExecution: string;
    codeExecutionDesc: string;
    other: string;
    otherDesc: string;
  };

  // Validation messages
  validation: {
    nameRequired: string;
    nameTooShort: string;
    nameTooLong: string;
    nameInvalid: string;
    nameDuplicate: string;
    descriptionRequired: string;
    descriptionTooShort: string;
    modelRequired: string;
    setupRequired: string;
    domainRequired: string;
    invalidPath: string;
    fileTooLarge: string;
    unsupportedFormat: string;
  };

  // Error messages
  errors: {
    generic: string;
    networkError: string;
    apiError: string;
    saveFailed: string;
    loadFailed: string;
    createFailed: string;
    validationFailed: string;
    unauthorized: string;
    notFound: string;
    rateLimited: string;
    timeout: string;
  };

  // Success messages
  success: {
    agentCreated: string;
    agentUpdated: string;
    agentDeleted: string;
    draftSaved: string;
    configExported: string;
    configImported: string;
    changesDiscarded: string;
  };

  // Help and documentation
  help: {
    needHelp: string;
    documentation: string;
    tutorials: string;
    faq: string;
    contactSupport: string;
    keyboardShortcuts: string;
    showShortcuts: string;
    hideShortcuts: string;
  };

  // Keyboard shortcuts
  shortcuts: {
    title: string;
    saveDraft: string;
    nextStep: string;
    previousStep: string;
    closeModal: string;
    toggleHelp: string;
    search: string;
    undo: string;
    redo: string;
  };

  // Export/Import
  exportImport: {
    export: string;
    import: string;
    exportConfig: string;
    importConfig: string;
    exportJson: string;
    exportYaml: string;
    importFromFile: string;
    importFromTemplate: string;
    shareConfig: string;
    copyToClipboard: string;
    downloadFile: string;
    uploadFile: string;
    dragDrop: string;
    invalidFile: string;
    parseError: string;
    confirmOverwrite: string;
  };

  // Analytics consent
  analytics: {
    consentTitle: string;
    consentMessage: string;
    accept: string;
    decline: string;
    managePreferences: string;
    privacyPolicy: string;
  };

  // Date/Time formatting
  dateTime: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    weeksAgo: string;
    monthsAgo: string;
    yearsAgo: string;
    yesterday: string;
    today: string;
    tomorrow: string;
    am: string;
    pm: string;
  };

  // File operations
  files: {
    bytes: string;
    kilobytes: string;
    megabytes: string;
    fileSize: string;
    uploadProgress: string;
    downloadProgress: string;
    fileTypes: string;
  };

  // Accessibility
  a11y: {
    openMenu: string;
    closeMenu: string;
    expandSection: string;
    collapseSection: string;
    selectedItem: string;
    loading: string;
    complete: string;
    error: string;
  };
}

/**
 * i18n Context interface
 */
export interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  ready: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Type for nested translation keys
 */
export type TranslationKey =
  | 'common.save'
  | 'common.cancel'
  | 'common.close'
  | 'common.next'
  | 'common.back'
  | 'common.loading'
  | 'common.error'
  | 'common.success'
  | 'common.delete'
  | 'common.edit'
  | 'common.add'
  | 'common.remove'
  | 'common.confirm'
  | 'common.search'
  | 'common.filter'
  | 'common.reset'
  | 'common.done'
  | 'common.retry'
  | 'common.skip'
  | 'common.finish'
  | 'wizard.step'
  | 'wizard.of'
  | 'wizard.progress'
  | 'wizard.draftSaved'
  | 'wizard.draftSavedAt'
  | 'wizard.unsavedChanges'
  | 'wizard.leaveConfirmation'
  | 'wizard.stay'
  | 'wizard.leave'
  | `steps.${keyof Translations['steps']}.${string}`
  | `agentTypes.${keyof Translations['agentTypes']}`
  | `agentSetups.${keyof Translations['agentSetups']}`
  | `temperaments.${keyof Translations['temperaments']}`
  | `voiceStyles.${keyof Translations['voiceStyles']}`
  | `mascotTemplates.${keyof Translations['mascotTemplates']}`
  | `hardBans.${keyof Translations['hardBans']}`
  | `validation.${keyof Translations['validation']}`
  | `errors.${keyof Translations['errors']}`
  | `success.${keyof Translations['success']}`
  | `help.${keyof Translations['help']}`
  | `shortcuts.${keyof Translations['shortcuts']}`
  | `exportImport.${keyof Translations['exportImport']}`
  | `analytics.${keyof Translations['analytics']}`
  | `dateTime.${keyof Translations['dateTime']}`
  | `files.${keyof Translations['files']}`
  | `a11y.${keyof Translations['a11y']}`;
