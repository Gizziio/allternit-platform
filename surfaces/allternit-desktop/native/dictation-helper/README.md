# Allternit Native Dictation Helper

Optional macOS speech-to-text helper for Allternit Desktop's call mode. When
staged, it is invoked by `VoiceManager` in the Electron main process and
streams transcripts back to the renderer via IPC.

## Build

```bash
cd surfaces/allternit-desktop/native/dictation-helper
swiftc -O DictationHelper.swift -o DictationHelper
```

Copy the resulting binary into the packaged resources so the desktop build can
find it:

```bash
mkdir -p surfaces/allternit-desktop/resources/bin
cp surfaces/allternit-desktop/native/dictation-helper/DictationHelper \
   surfaces/allternit-desktop/resources/bin/
```

The Electron build's `extraResources` already copies `resources/bin/` into the
app bundle.

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
