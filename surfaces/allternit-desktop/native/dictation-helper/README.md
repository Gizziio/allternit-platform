# Allternit Native Dictation Helper

Optional macOS speech-to-text helper for Allternit Desktop's call mode. When
staged, it is invoked by `VoiceManager` in the Electron main process and
streams transcripts back to the renderer via IPC.

## Build

```bash
cd surfaces/allternit-desktop/native/dictation-helper
swiftc -O DictationHelper.swift -o DictationHelper
```

Build the binary directly in the source directory so electron-builder can
stage it:

```bash
cd surfaces/allternit-desktop/native/dictation-helper
swiftc -O DictationHelper.swift -o DictationHelper
```

`surfaces/allternit-desktop/package.json` already includes an `extraResources`
entry that copies `native/dictation-helper/DictationHelper` into the app
bundle at `Contents/Resources/native/dictation-helper/DictationHelper`.

## Runtime

`VoiceManager` checks for the binary at:

- Packaged: `Contents/Resources/native/dictation-helper/DictationHelper`
- Dev: compiled on first use and cached in `~/Library/Application Support/Allternit/dictation-helper/DictationHelper`

If the binary is missing or fails to start, the renderer automatically falls
back to the browser's Web Speech API through `useSTT()`.

## Permissions

The parent app needs these entitlements and Info.plist strings:

- `com.apple.security.device.microphone`
- `com.apple.security.personal-information.speech-recognition`
- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

These are declared in:

- `surfaces/allternit-desktop/build/entitlements.mac.plist`
- `surfaces/allternit-desktop/package.json` (`build.mac.extendInfo`)
