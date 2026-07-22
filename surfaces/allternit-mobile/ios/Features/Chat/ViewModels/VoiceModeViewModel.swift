import AVFoundation
import Foundation
import SwiftUI

/// Turn state machine behind VoiceModeView (Phase 7b, Claude iOS voice-mode
/// parity). One turn: user speaks → live transcript (on-device Speech via
/// DictationController) → transcript sent through the EXISTING chat stream
/// path (ChatViewModel.sendMessage — the conversation stays in the normal
/// text thread) → the streamed reply is read aloud sentence-chunked
/// (SpeechSpeaker) → back to listening (hands-free) or idle (push-to-talk).
///
/// The view owns the DictationController/SpeechSpeaker objects and forwards
/// their changes here via SwiftUI `onChange` (the same wiring pattern
/// ComposerView uses for dictation) — no Combine inside the view model.
/// Errors surface in-place as a small status line; nothing here crashes.
@MainActor
final class VoiceModeViewModel: ObservableObject {
    /// Gradient-driving turn state. idle → listening → thinking (stream in
    /// flight) → speaking → listening…
    enum TurnState: String, Equatable, Sendable {
        case idle
        case listening
        case thinking
        case speaking
    }

    @Published private(set) var state: TurnState = .idle
    /// Live STT partial, rendered in italics at the bottom of the takeover.
    @Published var liveTranscript: String = ""
    /// The current reply's streamed text, rendered in serif.
    @Published private(set) var replyText: String = ""
    /// Mute gates BOTH directions: recognition won't (re)start and replies
    /// aren't read aloud while on.
    @Published private(set) var isMuted: Bool = false
    /// Small in-place error/status line (permission, engine, stream).
    @Published private(set) var statusLine: String? = nil

    private let chatViewModel: ChatViewModel
    private let runtimeModelId: String?
    private let effort: String?
    // Owned by the view (its @StateObjects); weak so teardown can't keep
    // audio resources alive past the cover's dismissal.
    private weak var dictation: DictationController?
    private weak var speaker: SpeechSpeaker?

    /// The in-flight assistant reply's message id (captured right after
    /// sendMessage appends its placeholder).
    private var replyMessageId: String? = nil
    private var startedAt: Date = Date()
    /// False once `endSession()` runs — late dictation/speech callbacks are
    /// dropped after the cover is gone.
    private var isActive: Bool = false
    /// Set when a dictation session is torn down by mute/interruption so its
    /// end isn't treated as a finished user turn.
    private var suppressNextDictationEnd: Bool = false
    /// `nonisolated(unsafe)` so deinit can unregister — same Swift 6.0
    /// deinit constraint DictationController documents (non-Sendable stored
    /// properties can't be read from a nonisolated deinit; here access is
    /// MainActor-only everywhere else and deinit has exclusive access).
    nonisolated(unsafe) private var interruptionObserver: NSObjectProtocol? = nil

    init(chatViewModel: ChatViewModel, runtimeModelId: String? = nil, effort: String? = nil) {
        self.chatViewModel = chatViewModel
        self.runtimeModelId = runtimeModelId
        self.effort = effort
    }

    deinit {
        if let observer = interruptionObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private var interactionMode: VoiceInteractionMode {
        SettingsStore.shared.voiceInteractionMode
    }

    /// True in push-to-talk mode — the mic button's hold gesture owns
    /// recognition starts (Settings → Voice settings → Mode).
    var isPushToTalk: Bool { interactionMode == .pushToTalk }

    // MARK: - Lifecycle

    /// Called from the view's onAppear with its audio objects. Configures
    /// the `.playAndRecord` session and enters the first turn — unless a
    /// DEBUG `-voice-state` fixture forces a static state for screenshots
    /// (no audio hardware on the simulator).
    func begin(dictation: DictationController, speaker: SpeechSpeaker) {
        self.dictation = dictation
        self.speaker = speaker
        startedAt = Date()
        isActive = true

        #if DEBUG
        if applyForcedStateIfAny() { return }
        #endif

        configurePlaybackSession()
        installInterruptionObserver()

        statusLine = nil
        switch interactionMode {
        case .handsFree:
            startListening()
        case .pushToTalk:
            // The mic button's hold gesture owns recognition starts.
            state = .idle
        }
    }

    /// X button: tears down audio and returns the session length in seconds
    /// for the feed's "Voice chat ended · Ns" card.
    func endSession() -> Int {
        isActive = false
        suppressNextDictationEnd = true
        dictation?.stop()
        speaker?.stop()
        if let observer = interruptionObserver {
            NotificationCenter.default.removeObserver(observer)
            interruptionObserver = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return max(1, Int(Date().timeIntervalSince(startedAt)))
    }

    // MARK: - Controls

    /// Mic tap toggles mute. Muting mid-turn discards any in-flight
    /// recognition; unmuting in hands-free resumes listening.
    func toggleMute() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        isMuted.toggle()
        if isMuted {
            suppressNextDictationEnd = true
            liveTranscript = ""
            dictation?.stop()
            speaker?.stop()
            if state == .listening || state == .speaking {
                state = .idle
            }
        } else if isActive, state == .idle, interactionMode == .handsFree {
            startListening()
        }
    }

    /// Push-to-talk: the mic button's hold gesture began.
    func pressBegan() {
        guard isActive, interactionMode == .pushToTalk, !isMuted else { return }
        guard state == .idle || state == .listening else { return }
        startListening()
    }

    /// Push-to-talk: released — stop recognition; the isRecording-false
    /// change forwards the transcript as a turn.
    func pressEnded() {
        guard isActive, interactionMode == .pushToTalk else { return }
        dictation?.stop()
    }

    // MARK: - Dictation events (wired by the view's onChange)

    /// DictationController stopped recording (silence, end tap, PTT release,
    /// error). A non-empty transcript becomes the next turn.
    func dictationEnded() {
        guard isActive else { return }
        if suppressNextDictationEnd {
            suppressNextDictationEnd = false
            return
        }
        let transcript = dictation?.transcript.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if transcript.isEmpty {
            // Silence with nothing said: hands-free re-arms; PTT stays idle.
            if interactionMode == .handsFree, !isMuted, state == .listening {
                startListening()
            } else if state == .listening {
                state = .idle
            }
            return
        }
        sendTurn(transcript)
    }

    func dictationFailed(_ message: String) {
        guard isActive else { return }
        statusLine = message
        state = .idle
    }

    // MARK: - Streaming reply (wired by the view's onChange)

    /// The chat feed changed — track the current reply's text and drive the
    /// thinking → speaking transition.
    func replyUpdated(_ messages: [MessageRecord]) {
        guard isActive, let replyMessageId,
              let reply = messages.first(where: { $0.id == replyMessageId }) else { return }
        guard state == .thinking || state == .speaking else { return }

        replyText = reply.content

        if let error = reply.error {
            statusLine = error.title
            speaker?.stop()
            state = .idle
            self.replyMessageId = nil
            return
        }

        guard !reply.isStreaming, state == .thinking else { return }

        // Stream finished: read the reply sentence-chunked, then take the
        // next turn when the speaker drains (speakerFinished below).
        self.replyMessageId = nil
        if isMuted || reply.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            advanceAfterSpeech()
            return
        }
        state = .speaking
        // Dictation's teardown deactivated the audio session — re-apply the
        // playback configuration before queueing utterances.
        configurePlaybackSession()
        speakSentenceChunks(of: reply.content)
        // A reply whose chunks were all empty never starts the synthesizer —
        // don't park in .speaking waiting for a finish that never comes.
        if speaker?.isSpeaking != true {
            advanceAfterSpeech()
        }
    }

    /// SpeechSpeaker drained its queue (wired from `speaker.isSpeaking`).
    func speakerFinished() {
        guard isActive, state == .speaking else { return }
        advanceAfterSpeech()
    }

    // MARK: - Turns

    private func startListening() {
        guard !isMuted, let dictation else { return }
        statusLine = nil
        liveTranscript = ""
        state = .listening
        Task { await dictation.start() }
    }

    private func sendTurn(_ transcript: String) {
        liveTranscript = ""
        replyText = ""
        statusLine = nil
        state = .thinking
        chatViewModel.sendMessage(transcript, runtimeModelId: runtimeModelId, effort: effort)
        // sendMessage appends the user bubble + streaming assistant
        // placeholder synchronously — the placeholder is the reply.
        replyMessageId = chatViewModel.messages.last(where: { $0.role == "assistant" })?.id
        if replyMessageId == nil {
            // Never happens with the current send path, but degrade instead
            // of parking in .thinking forever.
            statusLine = "Couldn't start the reply stream."
            state = .idle
        }
    }

    /// Next turn after a spoken reply: hands-free re-listens, PTT idles.
    private func advanceAfterSpeech() {
        guard isActive else { return }
        if interactionMode == .handsFree, !isMuted {
            // Back to record mode for the next turn.
            startListening()
        } else {
            state = .idle
        }
    }

    /// Splits the reply into sentences and queues them on SpeechSpeaker so
    /// prosody pauses land naturally (one utterance per sentence).
    private func speakSentenceChunks(of text: String) {
        for sentence in Self.sentences(in: text) {
            speaker?.speakChunk(sentence)
        }
    }

    /// Sentence splitter: breaks after ., !, ?, or a newline, keeping the
    /// terminator. Good enough for speech chunking — abbreviations just
    /// produce shorter chunks, not wrong words.
    nonisolated static func sentences(in text: String) -> [String] {
        var sentences: [String] = []
        var current = ""
        for character in text {
            current.append(character)
            if character == "." || character == "!" || character == "?" || character == "\n" {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { sentences.append(trimmed) }
                current = ""
            }
        }
        let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { sentences.append(trimmed) }
        return sentences
    }

    // MARK: - Audio session

    /// `.playAndRecord` with duck-others so a reply reads through the
    /// speaker while the session can flip back to recording for the next
    /// turn without a category change. DictationController reconfigures to
    /// `.record` while it runs; this is re-applied before playback.
    private func configurePlaybackSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default, options: [.duckOthers, .defaultToSpeaker])
        try? session.setActive(true, options: .notifyOthersOnDeactivation)
    }

    /// Phone-call / Siri interruptions: pause in place; resume hands-free
    /// listening when the system says we may.
    private func installInterruptionObserver() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            // Extract Sendable values before hopping to the MainActor — the
            // notification's userInfo dictionary isn't Sendable.
            guard let info = notification.userInfo,
                  let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
            let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            Task { @MainActor in
                guard let self, self.isActive else { return }
                switch type {
                case .began:
                    self.suppressNextDictationEnd = true
                    self.dictation?.stop()
                    self.speaker?.stop()
                    self.statusLine = "Paused — audio interrupted"
                    self.state = .idle
                case .ended:
                    let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
                    if options.contains(.shouldResume), self.interactionMode == .handsFree, !self.isMuted {
                        self.startListening()
                    }
                @unknown default:
                    break
                }
            }
        }
    }

    // MARK: - DEBUG fixtures

    #if DEBUG
    /// `-voice-state listening|thinking|speaking` (DEBUG only): pins the
    /// takeover in one gradient state with fixture text for screenshot
    /// verification — the simulator has no real microphone. Returns true
    /// when a fixture was applied (real audio is skipped entirely).
    private func applyForcedStateIfAny() -> Bool {
        guard let raw = UserDefaults.standard.string(forKey: "voice-state") else { return false }
        switch raw {
        case "idle":
            state = .idle
        case "listening":
            state = .listening
            liveTranscript = "So the deploy should run before the…"
        case "thinking":
            state = .thinking
        case "speaking":
            state = .speaking
            replyText = "Good thought — running the deploy first keeps the migration reversible. I'd stage it behind the feature flag, watch error rates for ten minutes, then roll it out to everyone."
        default:
            return false
        }
        return true
    }
    #endif
}
