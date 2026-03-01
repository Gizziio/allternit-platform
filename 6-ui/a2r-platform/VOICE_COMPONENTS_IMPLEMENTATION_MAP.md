# Voice Components Implementation Map

## 6 Voice Components

| # | Component | Description | Key Props |
|---|-----------|-------------|-----------|
| 1 | **SpeechInput** | Voice recording button | `onTranscriptionChange`, `onAudioRecorded` |
| 2 | **AudioPlayer** | Audio playback controls | `AudioPlayerElement` |
| 3 | **Transcription** | Transcription text display | `segments`, `children(segment, index)` |
| 4 | **Persona** | Animated voice avatar | `state`, `variant` |
| 5 | **MicSelector** | Microphone device selector | `MicSelectorTrigger`, `MicSelectorContent` |
| 6 | **VoiceSelector** | Voice personality selector | `VoiceSelectorTrigger`, `VoiceSelectorContent` |

---

## Implementation Locations

### ChatView.tsx
- **SpeechInput** - In PromptInput toolbar for voice input
- **AudioPlayer** - For voice message playback
- **Transcription** - Display voice-to-text results
- **MicSelector** - In sidebar for device selection

### AgentView.tsx
- **Persona** - Visual avatar for the agent (idle, listening, speaking states)
- **VoiceSelector** - Voice settings tab
- **MicSelector** - Audio input device selection

### CoworkView.tsx
- **AudioPlayer** - For audio artifacts
- **SpeechInput** - Voice commands
- **Transcription** - Meeting transcription display
- **Persona** - Assistant visual

### CodeCanvas.tsx
- **SpeechInput** - Voice coding commands in PromptInput

---

## Component APIs

### SpeechInput
```tsx
<SpeechInput 
  onTranscriptionChange={(text) => setInput(text)}
  onAudioRecorded={async (blob) => transcribeAudio(blob)}
  lang="en-US"
/>
```

### AudioPlayer
```tsx
<AudioPlayer>
  <AudioPlayerElement src="/audio.mp3" />
  <AudioPlayerPlayButton />
  <AudioPlayerSeekBackwardButton />
  <AudioPlayerSeekForwardButton />
  <AudioPlayerTimeDisplay />
  <AudioPlayerTimeRange />
  <AudioPlayerPlaybackRateButton />
  <AudioPlayerMuteButton />
  <AudioPlayerVolumeRange />
</AudioPlayer>
```

### Transcription
```tsx
<Transcription segments={segments}>
  {(segment, index) => (
    <TranscriptionSegment key={index} segment={segment} index={index}>
      {segment.text}
    </TranscriptionSegment>
  )}
</Transcription>
```

### Persona
```tsx
<Persona 
  state="listening" // idle | listening | thinking | speaking | asleep
  variant="halo"    // command | glint | halo | mana | obsidian | opal
/>
```

### MicSelector
```tsx
<MicSelector>
  <MicSelectorTrigger>Select Microphone</MicSelectorTrigger>
  <MicSelectorContent>
    <MicSelectorInput />
    <MicSelectorList>
      {(devices) => devices.map(d => (
        <MicSelectorItem key={d.deviceId} value={d.deviceId}>
          <MicSelectorLabel device={d} />
        </MicSelectorItem>
      ))}
    </MicSelectorList>
  </MicSelectorContent>
</MicSelector>
```

### VoiceSelector
```tsx
<VoiceSelector>
  <VoiceSelectorTrigger>Select Voice</VoiceSelectorTrigger>
  <VoiceSelectorContent>
    <VoiceSelectorList>
      <VoiceSelectorItem value="voice1">
        <VoiceSelectorPreview />
        <VoiceSelectorName>Professional</VoiceSelectorName>
      </VoiceSelectorItem>
    </VoiceSelectorList>
  </VoiceSelectorContent>
</VoiceSelector>
```
