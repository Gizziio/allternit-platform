#!/usr/bin/env swift
/**
 * DictationHelper — Native macOS speech-to-text helper for Allternit Desktop.
 *
 * Streams partial and final transcripts to stdout as JSON lines. Designed to be
 * invoked from the Electron main process via NSTask / child_process.spawn.
 *
 * Usage:
 *   DictationHelper [localeIdentifier]
 *
 * Examples:
 *   DictationHelper en-US
 *   DictationHelper es-ES
 *
 * Output (JSON lines):
 *   {"type":"ready"}
 *   {"type":"transcript","text":"hello","isFinal":false}
 *   {"type":"transcript","text":"hello world","isFinal":true}
 *   {"type":"error","error":"..."}
 *
 * The helper stops cleanly on SIGTERM or when stdin reaches EOF.
 *
 * Build:
 *   swiftc -O DictationHelper.swift -o DictationHelper
 *
 * Requirements:
 *   - macOS 10.15+
 *   - Microphone access (NSMicrophoneUsageDescription)
 *   - Speech recognition access (NSSpeechRecognitionUsageDescription)
 *   - Internet access for server-side recognition unless on-device is available
 *
 * Note: This is an optional native enhancement. When the helper is not staged
 * or fails to start, the Allternit renderer falls back to the Web Speech API
 * through the existing useSTT() hook.
 */

import Foundation
import Speech
import AVFoundation

struct ReadyMessage: Codable {
    let type: String
}

struct TranscriptMessage: Codable {
    let type: String
    let text: String
    let isFinal: Bool
}

struct ErrorMessage: Codable {
    let type: String
    let error: String
}

func printJSON<T: Encodable>(_ value: T) {
    do {
        let data = try JSONEncoder().encode(value)
        if let line = String(data: data, encoding: .utf8) {
            print(line)
            fflush(stdout)
        }
    } catch {
        print("{\"type\":\"error\",\"error\":\"failed to encode status\"}")
    }
}

final class DictationSession: NSObject, SFSpeechRecognizerDelegate {
    private let speechRecognizer: SFSpeechRecognizer?
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let locale: Locale
    private var isRunning = false

    init(localeIdentifier: String) {
        self.locale = Locale(identifier: localeIdentifier)
        self.speechRecognizer = SFSpeechRecognizer(locale: self.locale)
        super.init()
        self.speechRecognizer?.delegate = self
    }

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
            DispatchQueue.main.async {
                guard let self = self else { return }
                switch authStatus {
                case .authorized:
                    self.requestMicrophoneAccess()
                case .denied:
                    printJSON(ErrorMessage(type: "error", error: "Speech recognition permission denied"))
                case .restricted:
                    printJSON(ErrorMessage(type: "error", error: "Speech recognition restricted on this device"))
                case .notDetermined:
                    printJSON(ErrorMessage(type: "error", error: "Speech recognition permission not determined"))
                @unknown default:
                    printJSON(ErrorMessage(type: "error", error: "Unknown speech recognition authorization status"))
                }
            }
        }
    }

    private func requestMicrophoneAccess() {
        // On macOS, microphone access is gated by the TCC prompt shown when the
        // audio engine first taps the input node. We proceed directly; if the
        // user denies access, beginRecognition will fail to start the engine and
        // report the error.
        beginRecognition()
    }

    private func beginRecognition() {
        guard !isRunning else { return }
        isRunning = true

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            printJSON(ErrorMessage(type: "error", error: "Failed to create recognition request"))
            return
        }
        recognitionRequest.shouldReportPartialResults = true
        if #available(macOS 13.0, *) {
            // Allow server-side recognition for better accuracy. Set to true for
            // strict on-device-only operation when network access is unavailable.
            recognitionRequest.requiresOnDeviceRecognition = false
        }

        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            if let error = error {
                printJSON(ErrorMessage(type: "error", error: error.localizedDescription))
                self.stop()
                return
            }
            if let result = result {
                printJSON(TranscriptMessage(type: "transcript", text: result.bestTranscription.formattedString, isFinal: result.isFinal))
                if result.isFinal {
                    self.stop()
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            printJSON(ReadyMessage(type: "ready"))
        } catch {
            printJSON(ErrorMessage(type: "error", error: "Failed to start audio engine: \(error.localizedDescription)"))
        }
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
    }
}

let localeIdentifier = CommandLine.arguments.dropFirst().first ?? "en-US"
let session = DictationSession(localeIdentifier: localeIdentifier)

let sigtermSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
sigtermSource.setEventHandler {
    session.stop()
    exit(0)
}
sigtermSource.resume()

signal(SIGINT) { _ in
    session.stop()
    exit(0)
}

// Stop when stdin closes (parent process exited).
let stdinSource = DispatchSource.makeReadSource(fileDescriptor: FileHandle.standardInput.fileDescriptor, queue: .main)
stdinSource.setEventHandler {
    session.stop()
    exit(0)
}
stdinSource.resume()

session.start()
RunLoop.main.run()
