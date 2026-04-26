# @allternit/remotioncard-plugin

Generate videos from natural language prompts using [Remotion](https://www.remotion.dev/) — a React framework for programmatic video.

## What this plugin does

This plugin turns a text description into a fully animated Remotion React component and optionally renders it to an MP4 file. It uses an LLM to generate the component code, then wires it into Remotion's rendering pipeline.

## Prerequisites

- **Node.js** 18+ installed
- **Remotion CLI** — install globally or locally:
  ```bash
  npm install -g remotion
  # or
  npx remotion
  ```
- **FFmpeg** — Remotion uses FFmpeg under the hood for MP4 encoding. Install via:
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu / Debian
  sudo apt-get install ffmpeg
  ```

## Actions

The plugin supports three actions via the `action` parameter:

### 1. `generate` (default)
Generates the Remotion component code and returns it.

```json
{
  "prompt": "A glowing logo reveal with particles fading in",
  "action": "generate"
}
```

### 2. `preview`
Returns the generated code plus a command to launch Remotion Studio for interactive preview.

```json
{
  "prompt": "A scrolling text credits sequence",
  "action": "preview"
}
```

### 3. `render`
Generates the code and immediately renders it to an MP4 using `npx remotion render`.

```json
{
  "prompt": "An animated bar chart showing sales growth",
  "action": "render",
  "durationInFrames": 300,
  "width": 1920,
  "height": 1080,
  "fps": 30
}
```

## Parameters

| Parameter          | Type   | Default | Description                          |
|--------------------|--------|---------|--------------------------------------|
| `prompt`           | string | —       | Natural language video description   |
| `action`           | string | `generate` | One of `generate`, `preview`, `render` |
| `durationInFrames` | number | `150`   | Total animation length in frames     |
| `width`            | number | `1920`  | Video width in pixels                |
| `height`           | number | `1080`  | Video height in pixels               |
| `fps`              | number | `30`    | Frames per second                    |

## Example prompts

- "A pulsing gradient background with a centered title card that fades in"
- "A 5-second countdown from 3 to 1 with explosive particle effects"
- "Two Sequences: first shows a logo sliding in from the left, then a tagline sliding up from the bottom"
- "A simple loading spinner that rotates and changes color over time"

## Notes

- The generated component is self-contained and uses only built-in Remotion APIs (`AbsoluteFill`, `Sequence`, `interpolate`, `useCurrentFrame`, `useVideoConfig`).
- No external images or fonts are referenced, so renders are deterministic and offline-capable.
- Rendering requires the Remotion CLI and FFmpeg to be available in your environment.
