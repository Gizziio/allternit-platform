import SwiftUI

/// Speech-locale options for the Voice section (Claude parity: a short list
/// of common locales, not the full CLDR set). Consumed by dictation
/// (DictationController builds its SFSpeechRecognizer from it) — persisted
/// here so the choice survives; nil in SettingsStore means System default.
enum SpeechLanguage: String, CaseIterable, Sendable {
    case englishUS = "en-US"
    case englishUK = "en-GB"
    case spanish = "es-ES"
    case french = "fr-FR"
    case german = "de-DE"
    case italian = "it-IT"
    case portuguese = "pt-BR"
    case japanese = "ja-JP"

    var label: String {
        switch self {
        case .englishUS: return "English (US)"
        case .englishUK: return "English (UK)"
        case .spanish: return "Español"
        case .french: return "Français"
        case .german: return "Deutsch"
        case .italian: return "Italiano"
        case .portuguese: return "Português (BR)"
        case .japanese: return "日本語"
        }
    }
}

/// Voice-mode interaction style (Phase 7b, Claude parity): hands-free
/// auto-listens after each spoken reply; push-to-talk gates recognition to
/// a hold gesture on the voice-mode mic button.
enum VoiceInteractionMode: String, CaseIterable, Sendable {
    case handsFree
    case pushToTalk

    var label: String {
        switch self {
        case .handsFree: return "Hands free"
        case .pushToTalk: return "Push to talk"
        }
    }
}

/// App-wide settings behind the sidebar gear (Phase 4 settings hub).
/// Persisted app-wide (UserDefaults), mirroring ToolOptionsStore's pattern.
///
/// These are UI-persisted flags. Where a flag has a live consumer it is
/// wired there:
/// - `artifactsEnabled` gates inline artifact cards in MessageRow.
/// - `webSearchDefault` seeds ToolOptionsStore.webSearch when the composer
///   toggle hasn't been touched yet (sent as `metadata.tools` on send).
/// The rest await their consumers (code execution, model switching on flag,
/// memory generation, voice output speed, training opt-out) and are marked at
/// their use sites in SettingsView.
@MainActor
final class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    // MARK: - Capabilities

    /// "Artifacts" — render inline artifact cards in chat.
    @Published var artifactsEnabled: Bool {
        didSet { defaults.set(artifactsEnabled, forKey: Keys.artifactsEnabled) }
    }
    /// "Code execution and file creation" — no consumer wired yet.
    @Published var codeExecutionEnabled: Bool {
        didSet { defaults.set(codeExecutionEnabled, forKey: Keys.codeExecutionEnabled) }
    }
    /// "Web search" — seeds the composer "+" sheet's Web search toggle until
    /// the user overrides it there (see ToolOptionsStore.init).
    @Published var webSearchDefault: Bool {
        didSet { defaults.set(webSearchDefault, forKey: Keys.webSearchDefault) }
    }
    /// "Switch models when a message is flagged" — no consumer wired yet.
    @Published var switchModelsOnFlag: Bool {
        didSet { defaults.set(switchModelsOnFlag, forKey: Keys.switchModelsOnFlag) }
    }

    // MARK: - Memory

    /// "Generate memory from chat history" — persisted locally; the memory
    /// consolidation pipeline consumes it in a later phase.
    @Published var generateMemoryFromHistory: Bool {
        didSet { defaults.set(generateMemoryFromHistory, forKey: Keys.generateMemoryFromHistory) }
    }

    // MARK: - Voice

    /// Dictation locale — consumed by DictationController when a dictation
    /// session starts. nil = System default (follows Locale.current, which
    /// is also the first-run default; the onboarding sheet offers the same
    /// choice and writes this same key).
    @Published var speechLanguage: SpeechLanguage? {
        didSet { defaults.set(speechLanguage?.rawValue, forKey: Keys.speechLanguage) }
    }
    /// Playback/dictation speed — consumed by SpeechSpeaker's utterances
    /// (read-aloud + voice mode replies).
    @Published var speechSpeed: Double {
        didSet { defaults.set(speechSpeed, forKey: Keys.speechSpeed) }
    }
    /// Voice-mode picker selection (Phase 7b): an on-device
    /// AVSpeechSynthesisVoice identifier from VoiceSettingsSheet's list.
    /// Consumed by SpeechSpeaker; nil = system default voice.
    @Published var voiceIdentifier: String? {
        didSet { defaults.set(voiceIdentifier, forKey: Keys.voiceIdentifier) }
    }
    /// Voice-mode interaction style — consumed by VoiceModeViewModel.
    @Published var voiceInteractionMode: VoiceInteractionMode {
        didSet { defaults.set(voiceInteractionMode.rawValue, forKey: Keys.voiceInteractionMode) }
    }

    // MARK: - Data controls

    /// "Improve the model for everyone" (training opt-in) — local only; the
    /// backend has no preference endpoint yet.
    @Published var improveModel: Bool {
        didSet { defaults.set(improveModel, forKey: Keys.improveModel) }
    }

    // MARK: - Products (Settings > Products parity)

    /// Gizziio Code: bypass desktop permission checks (developer-only).
    @Published var gizziBypassPermissions: Bool {
        didSet { defaults.set(gizziBypassPermissions, forKey: Keys.gizziBypassPermissions) }
    }
    /// Gizziio Code: draw-attention notifications.
    @Published var gizziDrawAttentionNotifications: Bool {
        didSet { defaults.set(gizziDrawAttentionNotifications, forKey: Keys.gizziDrawAttentionNotifications) }
    }
    /// Gizziio Code: enable browser tools.
    @Published var gizziBrowserTools: Bool {
        didSet { defaults.set(gizziBrowserTools, forKey: Keys.gizziBrowserTools) }
    }
    /// Gizziio Code: auto-create pull requests.
    @Published var gizziAutoCreatePRs: Bool {
        didSet { defaults.set(gizziAutoCreatePRs, forKey: Keys.gizziAutoCreatePRs) }
    }
    /// Gizziio Code: autofix failing PRs.
    @Published var gizziAutofixPRs: Bool {
        didSet { defaults.set(gizziAutofixPRs, forKey: Keys.gizziAutofixPRs) }
    }

    /// Extensions: auto-update marketplace/sidecar extensions.
    @Published var extensionsAutoUpdate: Bool {
        didSet { defaults.set(extensionsAutoUpdate, forKey: Keys.extensionsAutoUpdate) }
    }
    /// Extensions: use built-in Node runtime.
    @Published var extensionsUseBuiltinNode: Bool {
        didSet { defaults.set(extensionsUseBuiltinNode, forKey: Keys.extensionsUseBuiltinNode) }
    }

    /// Voice speed steps offered in the picker.
    static let speechSpeeds: [Double] = [0.75, 1.0, 1.25, 1.5]

    private let defaults: UserDefaults

    private enum Keys {
        static let artifactsEnabled = "allternit-settings-artifacts"
        static let codeExecutionEnabled = "allternit-settings-code-execution"
        static let webSearchDefault = "allternit-settings-web-search-default"
        static let switchModelsOnFlag = "allternit-settings-switch-models-on-flag"
        static let generateMemoryFromHistory = "allternit-settings-generate-memory"
        static let speechLanguage = "allternit-settings-speech-language"
        static let speechSpeed = "allternit-settings-speech-speed"
        static let voiceIdentifier = "allternit-settings-voice-identifier"
        static let voiceInteractionMode = "allternit-settings-voice-interaction-mode"
        static let improveModel = "allternit-settings-improve-model"
        static let gizziBypassPermissions = "allternit-settings-gizzi-bypass-permissions"
        static let gizziDrawAttentionNotifications = "allternit-settings-gizzi-draw-attention"
        static let gizziBrowserTools = "allternit-settings-gizzi-browser-tools"
        static let gizziAutoCreatePRs = "allternit-settings-gizzi-auto-prs"
        static let gizziAutofixPRs = "allternit-settings-gizzi-autofix-prs"
        static let extensionsAutoUpdate = "allternit-settings-extensions-auto-update"
        static let extensionsUseBuiltinNode = "allternit-settings-extensions-builtin-node"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        // `object(forKey:)` distinguishes "never set" from an explicit false,
        // so first-run defaults can be true without overriding user choices.
        self.artifactsEnabled = defaults.object(forKey: Keys.artifactsEnabled) as? Bool ?? true
        self.codeExecutionEnabled = defaults.object(forKey: Keys.codeExecutionEnabled) as? Bool ?? false
        self.webSearchDefault = defaults.object(forKey: Keys.webSearchDefault) as? Bool ?? true
        self.switchModelsOnFlag = defaults.object(forKey: Keys.switchModelsOnFlag) as? Bool ?? false
        self.generateMemoryFromHistory = defaults.object(forKey: Keys.generateMemoryFromHistory) as? Bool ?? false
        // nil (never chosen) = System default — matches dictation's
        // pre-setting behavior (Locale.current).
        self.speechLanguage = defaults.string(forKey: Keys.speechLanguage)
            .flatMap(SpeechLanguage.init(rawValue:))
        self.speechSpeed = defaults.object(forKey: Keys.speechSpeed) as? Double ?? 1.0
        self.voiceIdentifier = defaults.string(forKey: Keys.voiceIdentifier)
        self.voiceInteractionMode = defaults.string(forKey: Keys.voiceInteractionMode)
            .flatMap(VoiceInteractionMode.init(rawValue:)) ?? .handsFree
        self.improveModel = defaults.object(forKey: Keys.improveModel) as? Bool ?? true
        self.gizziBypassPermissions = defaults.object(forKey: Keys.gizziBypassPermissions) as? Bool ?? false
        self.gizziDrawAttentionNotifications = defaults.object(forKey: Keys.gizziDrawAttentionNotifications) as? Bool ?? true
        self.gizziBrowserTools = defaults.object(forKey: Keys.gizziBrowserTools) as? Bool ?? true
        self.gizziAutoCreatePRs = defaults.object(forKey: Keys.gizziAutoCreatePRs) as? Bool ?? false
        self.gizziAutofixPRs = defaults.object(forKey: Keys.gizziAutofixPRs) as? Bool ?? true
        self.extensionsAutoUpdate = defaults.object(forKey: Keys.extensionsAutoUpdate) as? Bool ?? true
        self.extensionsUseBuiltinNode = defaults.object(forKey: Keys.extensionsUseBuiltinNode) as? Bool ?? true
    }
}
