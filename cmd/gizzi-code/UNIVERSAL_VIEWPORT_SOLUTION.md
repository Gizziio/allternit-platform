# Universal Cross-Platform Viewport Solution

## Key Finding: @opentui/core Capabilities

✅ **Already have:**
- `jimp` v1.6.0 - Image processing
- `marked` v17.0.1 - Markdown rendering
- `diff` v8.0.2 - Diff rendering
- **Kitty graphics protocol detection** in terminal capabilities
- Viewport support (EditorView, TextBufferView)
- Yoga Layout - Flexbox layout engine

---

## **RECOMMENDED: Hybrid Multi-Fallback Approach**

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Viewport Display Pipeline                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Content Type Detection                                      │
│       ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Native TUI Rendering (FIRST CHOICE)               │   │
│  │    - Markdown → marked → styled text                 │   │
│  │    - Code → syntax highlighting                      │   │
│  │    - Diff → diff library                             │   │
│  │    - Images → jimp → ASCII/kitty/sixel               │   │
│  └──────────────────────────────────────────────────────┘   │
│       ↓ (if native fails or needs browser)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 2. Terminal Graphics Protocol                        │   │
│  │    - Detect terminal capabilities                    │   │
│  │    - Use: kitty (if supported)                       │   │
│  │    - Or: iTerm2 (macOS)                              │   │
│  │    - Or: Sixel (Linux/SSH)                           │   │
│  │    - Or: ASCII fallback (universal)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│       ↓ (for full interactivity)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 3. Hybrid Browser Window                             │   │
│  │    - Puppeteer → screenshot → display OR             │   │
│  │    - Open actual browser window                      │   │
│  │    - IPC for control from TUI                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## **Universal Standard Solution**

### What Works on ALL Platforms

| Content Type | Display Method | Works On |
|--------------|----------------|----------|
| **Text/Code** | Native TUI text | ✅ Everything |
| **Markdown** | `marked` → styled text | ✅ Everything |
| **Diff** | `diff` library → colored text | ✅ Everything |
| **Images** | jimp → ASCII art | ✅ Everything |
| **Web Pages** | Puppeteer → screenshot → ASCII | ✅ Everything |
| **Interactive** | Browser window (hybrid) | ✅ Everything |

---

## Implementation Strategy

### Phase 1: Native TUI Rendering (Works Everywhere)

#### A. Markdown Rendering
```typescript
import { marked } from "marked"

function renderMarkdown(content: string) {
  const tokens = marked.lexer(content)
  // Render to TUI styled text
  return tokens.map(token => ({
    type: token.type,
    text: token.text,
    style: getStyleForTokenType(token.type)
  }))
}
```

#### B. Image → ASCII (Universal Fallback)
```typescript
import { jimp } from "jimp"

async function imageToASCII(imageBuffer: ArrayBuffer, width: number, height: number) {
  const image = await jimp.read(imageBuffer)
  image.resize(width, height)
  
  const ascii = ""
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = image.getPixelColor(x, y)
      const brightness = getBrightness(pixel)
      ascii += charForBrightness(brightness)
    }
    ascii += "\n"
  }
  return ascii
}
```

#### C. Syntax Highlighting
```typescript
// Already using tree-sitter in @opentui/core
import { SyntaxStyle } from "@opentui/core"

const style = SyntaxStyle.create()
// Apply to code blocks
```

---

### Phase 2: Terminal Graphics (When Available)

#### Auto-Detection
```typescript
import { TerminalCapabilities } from "@opentui/core"

function detectGraphicsSupport() {
  const caps = TerminalCapabilities.query()
  
  if (caps.kitty_graphics) return "kitty"
  if (process.env.TERM_PROGRAM === "iTerm2") return "iterm2"
  if (process.env.TERM === "xterm") return "sixel"
  
  return "ascii" // Universal fallback
}
```

#### Kitty Protocol (Best Quality)
```typescript
function displayKittyImage(buffer: ArrayBuffer, options: {
  x: number, y: number,
  width: number, height: number
}) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const escape = `\x1b_Ga=T,f=png,s=${options.width},v=${options.height};${base64}\x1b\\`
  process.stdout.write(escape)
}
```

#### iTerm2 Protocol (macOS)
```typescript
function displayITerm2Image(buffer: ArrayBuffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const escape = `\x1b]1337;File=inline=1:${base64}\x07`
  process.stdout.write(escape)
}
```

---

### Phase 3: Browser Integration (For Web Content)

#### Screenshot Approach (Display in TUI)
```typescript
import puppeteer from "puppeteer"
import { jimp } from "jimp"

async function previewWebpage(url: string) {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0' })
  
  const screenshot = await page.screenshot({
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 720 }
  })
  
  // Convert to ASCII or use terminal graphics
  const ascii = await imageToASCII(screenshot, 80, 40)
  displayInViewport(ascii)
  
  await browser.close()
}
```

#### Hybrid Browser Window (Full Interactivity)
```typescript
import open from "open"

async function interactiveWebPreview(url: string) {
  // Open browser window
  await open(url)
  
  // Control from TUI via IPC or keyboard shortcuts
  // TUI remains usable alongside browser
}
```

---

## **Content-Type Based Rendering**

### Decision Matrix

| Content | Primary Method | Fallback 1 | Fallback 2 |
|---------|---------------|------------|------------|
| **Markdown (.md)** | marked → TUI text | - | - |
| **Code (.ts, .js, etc)** | Syntax highlight | Plain text | - |
| **Diff (.diff, .patch)** | diff → colored | Plain text | - |
| **Image (.png, .jpg)** | kitty/sixel | iTerm2 | ASCII |
| **Web (http://)** | Screenshot → ASCII | Browser window | - |
| **HTML (.html)** | Render → screenshot | Text extract | Browser |
| **PDF (.pdf)** | Text extract | Screenshot | Browser |
| **Video (.mp4)** | Frame extract | ASCII animation | Browser |

---

## **Viewport Component Architecture**

```typescript
interface ViewportProps {
  content: Content
  contentType: "markdown" | "code" | "image" | "web" | "artifact"
  interactive?: boolean
}

export function Viewport(props: ViewportProps) {
  const capabilities = useTerminalCapabilities()
  
  return (
    <box id="viewport" flexGrow={1}>
      {props.contentType === "markdown" && (
        <MarkdownRenderer content={props.content} />
      )}
      
      {props.contentType === "code" && (
        <CodeRenderer content={props.content} language="typescript" />
      )}
      
      {props.contentType === "image" && (
        <ImageRenderer 
          content={props.content}
          method={capabilities.graphics} // "kitty" | "iterm2" | "ascii"
        />
      )}
      
      {props.contentType === "web" && (
        <WebRenderer 
          url={props.content}
          mode={props.interactive ? "browser" : "screenshot"}
        />
      )}
      
      {props.contentType === "artifact" && (
        <ArtifactRenderer content={props.content} />
      )}
    </box>
  )
}
```

---

## **Universal Standard: What to Build**

### 1. Terminal Capability Detection ✅
```typescript
// Use @opentui/core's built-in detection
const caps = TerminalCapabilities.query()
// Returns: { kitty_graphics: boolean, rgb: boolean, unicode: boolean }
```

### 2. Multi-Format Renderer
- **Markdown**: Use `marked` (already in @opentui/core)
- **Code**: Use tree-sitter syntax highlighting (already in @opentui/core)
- **Diff**: Use `diff` library (already in @opentui/core)
- **Images**: Use `jimp` (already in @opentui/core)

### 3. Image Display Pipeline
```
Image → jimp → [kitty/iterm2/sixel/ASCII] → Terminal
```

### 4. Web Preview Pipeline
```
URL → Puppeteer → Screenshot → jimp → ASCII → Terminal
OR
URL → Open Browser Window → IPC Control
```

### 5. Artifact Display
```
File → Detect Type → Appropriate Renderer → Terminal
```

---

## **Cross-Platform Guarantee**

### What Works Everywhere:

1. **Text/Code**: ✅ Native TUI (all platforms)
2. **Markdown**: ✅ `marked` → TUI text (all platforms)
3. **Images**: ✅ jimp → ASCII art (all platforms)
4. **Web**: ✅ Puppeteer → screenshot → ASCII (all platforms)
5. **Interactive**: ✅ Browser window hybrid (all platforms)

### Enhanced on Supported Terminals:

1. **kitty/WezTerm**: High-quality images via kitty protocol
2. **iTerm2**: High-quality images via iTerm2 protocol
3. **xterm**: Sixel graphics support
4. **Others**: ASCII fallback (still works!)

---

## **Implementation Priority**

### Week 1: Foundation (Universal)
- [ ] Terminal capability detection
- [ ] Markdown renderer (marked)
- [ ] Code renderer (syntax highlighting)
- [ ] Image → ASCII converter (jimp)
- [ ] Basic viewport layout

### Week 2: Enhanced Graphics
- [ ] Kitty protocol support
- [ ] iTerm2 protocol support
- [ ] Sixel support (optional)
- [ ] Auto-detection and fallback

### Week 3: Web Integration
- [ ] Puppeteer integration
- [ ] Screenshot → ASCII pipeline
- [ ] Browser window hybrid mode
- [ ] Keyboard navigation

### Week 4: Artifacts & Polish
- [ ] File type detection
- [ ] Diff rendering
- [ ] Multi-format artifact support
- [ ] Testing on all platforms

---

## **Answer to Your Question**

> "Which viewport will work standard for all platforms for what I ask?"

**Answer: Hybrid ASCII-First Approach**

1. **Primary**: Native TUI rendering (text, markdown, code, diff)
2. **Images**: jimp → ASCII art (works everywhere)
3. **Web**: Puppeteer → screenshot → ASCII (works everywhere)
4. **Interactive**: Open browser window alongside TUI (works everywhere)
5. **Enhanced**: Use kitty/iterm2 protocols when available (better quality)

**This guarantees:**
- ✅ Works on ALL platforms (macOS, Linux, Windows)
- ✅ Works in ALL terminals (Apple Terminal, iTerm2, kitty, Windows Terminal)
- ✅ Works over SSH
- ✅ Works in tmux/screen
- ✅ Browser previews work (via screenshot or hybrid)
- ✅ Artifacts display (via appropriate renderers)
- ✅ Interactivity possible (via browser window)

---

## **Next Steps**

1. **Build ASCII-first viewport** (universal)
2. **Add terminal detection** (for enhanced modes)
3. **Integrate Puppeteer** (for web content)
4. **Test on all platforms**

**Shall I proceed with implementation?**
