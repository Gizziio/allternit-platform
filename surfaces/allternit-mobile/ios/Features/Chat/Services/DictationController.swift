import AVFoundation
import Foundation
import Speech

/// Live dictation engine for the composer mic (Claude parity): mic tap →
/// live transcription into the editable text field.
///
/// Wraps SFSpeechRecognizer + AVAudioEngine behind a MainActor surface.
/// Partial results publish into `transcript` as they arrive — the composer
/// renders them as base-text + partial so Speech's word corrections replace
/// earlier words instead of appending. A short silence auto-stops the
/// session; `stop()` keeps the last transcript for the field to fold in.
///
/// Swift 6 notes: the audio tap runs on the render thread and the Speech
/// result handler on an arbitrary queue, so both cross the actor boundary
/// carrying Sendable values only; `isolated deinit` keeps MainActor-state
/// teardown legal.
@MainActor
final class DictationController: ObservableObject {
    /// Latest transcript (partial results included); empty until Speech
    /// delivers the first result.
    @Published private(set) var transcript: String = ""
    @Published private(set) var isRecording: Bool = false
    /// User-facing failure (permission denied, engine start, recognition
    /// error); cleared at the next `start()`.
    @Published var errorMessage: String? = nil

    private let speechRecognizer: SFSpeechRecognizer
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    /// Silence auto-stop; re-armed by every partial result.
    private var silenceTask: Task<Void, Never>?

    /// No new partials for this long → end the session (stop-on-silence).
    private static let silenceTimeoutNs: UInt64 = 2_500_000_000

    init() {
        // Locale.current follows the system language; the parameterless
        // initializer is the fallback for locales Speech doesn't ship.
        speechRecognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer()
    }

    /// MainActor classes can't touch isolated state from a plain deinit in
    /// Swift 6 — `isolated deinit` keeps mic/engine teardown legal.
    isolated deinit {
        teardown()
    }

    // MARK: - Start / stop

    /// Requests permissions (first run surfaces both system prompts), then
    /// starts capture. No-op while already recording.
    func start() async {
        guard !isRecording else { return }
        errorMessage = nil
        transcript = ""

        guard await requestAuthorization() else { return }
        guard speechRecognizer.isAvailable else {
            errorMessage = "Speech recognition isn't available right now."
            return
        }

        do {
            try beginRecording()
            isRecording = true
            scheduleSilenceStop()
        } catch {
            teardown()
            errorMessage = "Couldn't start dictation: \(error.localizedDescription)"
        }
    }

    /// End tap: stop capture, keep the last transcript.
    func stop() {
        guard isRecording else { return }
        teardown()
    }

    /// Shared teardown for end tap / final result / silence / error: stops
    /// the engine, ends the request, and deactivates the audio session.
    private func teardown() {
        silenceTask?.cancel()
        silenceTask = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        if let engine = audioEngine {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        audioEngine = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isRecording = false
    }

    // MARK: - Authorization

    /// Speech + mic authorization; returns false (with `errorMessage` set)
    /// when either is denied.
    private func requestAuthorization() async -> Bool {
        let speechStatus = await withCheckedContinuation { (continuation: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speechStatus == .authorized else {
            errorMessage = "Speech recognition is off. Enable it in Settings to dictate messages."
            return false
        }

        // iOS 17+ async permission API (AVAudioSession's is deprecated).
        guard await AVAudioApplication.requestRecordPermission() else {
            errorMessage = "Microphone access is off. Enable it in Settings to dictate messages."
            return false
        }
        return true
    }

    // MARK: - Capture

    private func beginRecording() throws {
        recognitionTask?.cancel()
        recognitionTask = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let engine = AVAudioEngine()
        audioEngine = engine
        let inputNode = engine.inputNode

        // The tap block is @Sendable and runs on the audio render thread;
        // the non-Sendable request crosses in a box. It is only ever
        // appended there and ended on the MainActor — Speech's documented
        // producer pattern (Apple's own sample does the same).
        let requestBox = UncheckedSendableBox(request)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputNode.outputFormat(forBus: 0)) { buffer, _ in
            requestBox.value.append(buffer)
        }

        engine.prepare()
        try engine.start()

        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            // Nonisolated and @Sendable — extract Sendable values and hop
            // to the MainActor (SFSpeechRecognitionResult isn't Sendable).
            let text = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            Task { @MainActor in
                self?.handleResult(text: text, isFinal: isFinal, error: error)
            }
        }
    }

    /// Applies one Speech callback on the MainActor. Late deliveries after
    /// `teardown()` are dropped so a stale final can't resurrect text the
    /// composer already sent.
    private func handleResult(text: String?, isFinal: Bool, error: (any Error)?) {
        guard isRecording else { return }

        if let text {
            transcript = text
            if isFinal {
                teardown()
                return
            }
            scheduleSilenceStop()
        }

        guard let error else { return }
        // Benign assistant-domain codes from natural teardown (cancel on
        // our own stop, "no speech detected", short-utterance retry) —
        // finish silently; anything else surfaces once via `errorMessage`.
        let nsError = error as NSError
        let benignCodes: Set<Int> = [203, 209, 1110]
        if !(nsError.domain == "kAFAssistantErrorDomain" && benignCodes.contains(nsError.code)) {
            errorMessage = "Dictation failed: \(error.localizedDescription)"
        }
        teardown()
    }

    /// Re-arms the silence auto-stop; every partial result pushes it out.
    private func scheduleSilenceStop() {
        silenceTask?.cancel()
        silenceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.silenceTimeoutNs)
            guard let self, !Task.isCancelled else { return }
            self.teardown()
        }
    }
}

/// Swift 6 capture helper: @Sendable closures (the audio tap) can't capture
/// the non-Sendable SFSpeechAudioBufferRecognitionRequest. The boxed value
/// is only touched from the tap thread (`append`) and the MainActor
/// (`endAudio`), matching Speech's documented usage.
private struct UncheckedSendableBox<Value>: @unchecked Sendable {
    let value: Value
}
