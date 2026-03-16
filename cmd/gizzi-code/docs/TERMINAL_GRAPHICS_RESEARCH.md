# Terminal Graphics Research - 5+ Solutions for Cowork Viewport

## Requirements
- Display browser previews (web content)
- Display artifacts (files, images, documents)
- Interactive if possible
- Work within TUI/terminal environment
- Compatible with `@opentui/core` (our current TUI framework)

---

## Solution 1: **Kitty Graphics Protocol** ⭐⭐⭐⭐⭐

### What It Is
Modern terminal graphics protocol developed for kitty terminal, now widely adopted.

### Capabilities
- **Images**: PNG, JPEG, GIF, WebP, TIFF
- **Animations**: Animated GIFs
- **Transparency**: Full alpha channel support
- **Positioning**: Absolute positioning in terminal
- **Layers**: Multiple image layers
- **Compression**: Efficient zlib compression

### Terminal Support (2025)
✅ kitty (native)
✅ WezTerm (full support)
✅ foot (full support)
✅ Black Box (support)
❌ iTerm2 (uses own protocol)
❌ Windows Terminal (limited)
❌ Alacritty (no support yet)

### Implementation
```typescript
// Send image to terminal using kitty protocol
function displayImage(buffer: ArrayBuffer, options: {
  x: number, y: number,
  width: number, height: number,
  format: 'png' | 'jpeg' | 'gif'
}) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  // Kitty escape sequence
  const escape = `\x1b_Ga=T,f=${options.format},s=${width},v=${height},x=${x},y=${y};${base64}\x1b\\`
  process.stdout.write(escape)
}
```

### Libraries
- **kitty-graphics-protocol** (npm) - Protocol encoder
- **sharp** or **jimp** - Image processing (we already have jimp!)
- **@opentui/core** - May have built-in support (check docs)

### Pros
- ✅ High quality images
- ✅ Fast rendering
- ✅ Animation support
- ✅ Already using jimp (compatible)
- ✅ Modern standard

### Cons
- ❌ Not supported in all terminals
- ❌ No interactivity (static images only)
- ❌ Complex escape sequences

### Best For
- Static image display
- Screenshots of web pages
- Artifact previews

---

## Solution 2: **Sixel Graphics** ⭐⭐⭐⭐

### What It Is
DEC terminal standard from 1980s, revived for modern terminals. Uses 6-pixel high characters.

### Capabilities
- **Images**: Any format (converted to sixel)
- **Colors**: Up to 256 colors (ANSI palette)
- **Positioning**: Character-cell based
- **Animation**: Frame-by-frame possible

### Terminal Support (2025)
✅ xterm (native)
✅ mlterm
✅ yaft
✅ Black Box
✅ RLogin
❌ kitty (uses own protocol)
❌ iTerm2
❌ Windows Terminal
❌ Most common terminals

### Implementation
```typescript
import { SixelEncoder } from 'libsixel'

function displaySixel(imageBuffer: ArrayBuffer) {
  const encoder = new SixelEncoder({
    colors: 256,
    width: 400,
    height: 300
  })
  const sixelData = encoder.encode(imageBuffer)
  // Sixel escape sequence
  process.stdout.write(`\x1bP${sixelData}\x1b\\`)
}
```

### Libraries
- **libsixel** (C library with bindings)
- **sixel-rs** (Rust)
- **node-sixel** (npm - may be outdated)

### Pros
- ✅ Wide historical support
- ✅ Standard protocol
- ✅ Good color reproduction
- ✅ Works over SSH

### Cons
- ❌ Not supported in popular terminals (kitty, iTerm2)
- ❌ Lower quality than kitty
- ❌ Character-cell limitations
- ❌ No interactivity

### Best For
- Maximum compatibility (if terminals support it)
- SSH-based terminals
- Legacy terminal support

---

## Solution 3: **iTerm2 Inline Images Protocol** ⭐⭐⭐⭐

### What It Is
Proprietary protocol for iTerm2 (macOS only).

### Capabilities
- **Images**: Any format (base64 encoded)
- **Sizing**: Width/height in cells or pixels
- **Positioning**: Cursor-based
- **Metadata**: Title, alt text

### Terminal Support (2025)
✅ iTerm2 (macOS only)
❌ All other terminals

### Implementation
```typescript
function displayITerm2Image(buffer: ArrayBuffer, options: {
  width?: number, height?: number
}) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  const params = []
  if (options.width) params.push(`width=${options.width}`)
  if (options.height) params.push(`height=${options.height}`)
  
  const escape = `\x1b]1337;File=inline=1;${params.join(';')}:${base64}\x07`
  process.stdout.write(escape)
}
```

### Libraries
- Built-in (simple escape sequences)
- **iterm2-img** (npm)

### Pros
- ✅ Simple implementation
- ✅ High quality
- ✅ Works great on macOS (your platform!)
- ✅ iTerm2 is popular among developers

### Cons
- ❌ macOS/iTerm2 only
- ❌ No interactivity
- ❌ Proprietary

### Best For
- macOS users (you!)
- Developer-focused tools
- Simple image display

---

## Solution 4: **ASCII/Unicode Art Conversion** ⭐⭐⭐

### What It Is
Convert images to ASCII/Unicode characters.

### Capabilities
- **Images**: Any format → ASCII
- **Colors**: ANSI 256 or true color
- **Characters**: Custom ramps (dense to sparse)
- **Animation**: Frame-by-frame ASCII

### Terminal Support (2025)
✅ ALL terminals (universal)
✅ Works over SSH
✅ Works in tmux/screen
✅ No special support needed

### Implementation
```typescript
import { imageToASCII } from 'img2ascii'

function displayASCII(imageBuffer: ArrayBuffer) {
  const ascii = imageToASCII(imageBuffer, {
    width: 80,
    chars: '@%#*+=-:. ',
    colored: true
  })
  process.stdout.write(ascii)
}
```

### Libraries
- **img2ascii** (npm)
- **jp2a** (C, command-line)
- **ascii-image-converter** (npm)
- **jimp** (we have this!) + custom renderer

### Pros
- ✅ Universal compatibility
- ✅ No terminal requirements
- ✅ Works everywhere
- ✅ Nostalgic aesthetic
- ✅ We already have jimp!

### Cons
- ❌ Low resolution
- ❌ Loss of detail
- ❌ Not suitable for detailed content
- ❌ No interactivity

### Best For
- Maximum compatibility
- Fallback option
- Artistic/stylistic choice
- Quick previews

---

## Solution 5: **Terminal Web Browser / Screenshot Approach** ⭐⭐⭐⭐⭐

### What It Is
Capture webpage as image/screenshot, display in terminal.

### Capabilities
- **Web Content**: Full pages or viewport
- **Interactivity**: Via keyboard (links, forms)
- **Rendering**: Headless browser (Puppeteer, Playwright)
- **Output**: Image → terminal protocol

### Implementation
```typescript
import puppeteer from 'puppeteer'
import { displayImage } from './kitty-protocol'

async function previewWebpage(url: string) {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0' })
  
  // Capture screenshot
  const screenshot = await page.screenshot({
    fullPage: false,
    clip: { x: 0, y: 0, width: 1280, height: 720 }
  })
  
  // Display in terminal
  displayImage(screenshot, { format: 'png', ... })
  
  await browser.close()
}
```

### Libraries
- **puppeteer** or **playwright** - Headless browser
- **sharp** or **jimp** - Image processing
- **kitty-graphics-protocol** or **iterm2 protocol** - Display

### Pros
- ✅ Can display ANY web content
- ✅ Full browser rendering
- ✅ Interactive via keyboard (with proper implementation)
- ✅ Works with modern web apps
- ✅ Can capture dynamic content

### Cons
- ❌ Requires headless browser (resource intensive)
- ❌ Not real-time interaction
- ❌ Screenshot-based (clicks require recapture)

### Best For
- **Browser previews** (your requirement!)
- Web artifacts
- Dynamic content
- Modern web apps

---

## Solution 6: **Embedded WebView / iframe (Hybrid Approach)** ⭐⭐⭐⭐⭐

### What It Is
Use terminal multiplexer or hybrid TUI+web approach.

### Capabilities
- **Full Web**: Actual browser rendering
- **Interactive**: Full mouse/keyboard
- **Layout**: Split terminal/web view

### Implementation Options

#### A. tmux + WebView
```bash
# Run TUI in one pane, browser in another
tmux split-window -h
# Control both from TUI
```

#### B. Terminal with embedded webview
```typescript
// Some terminals support embedding webviews
import { WebView } from 'tauri'

function createViewport(url: string) {
  const webview = new WebView({
    url,
    width: 800,
    height: 600
  })
  // Embed in TUI layout
}
```

#### C. HTTP server + browser window
```typescript
// Start local server, open browser window
import open from 'open'

async function previewArtifact(content: string) {
  const port = await startServer(content)
  await open(`http://localhost:${port}`)
  // Control from TUI
}
```

### Pros
- ✅ FULL interactivity
- ✅ Real browser rendering
- ✅ No quality loss
- ✅ Can use web technologies
- ✅ Best user experience

### Cons
- ❌ Leaves terminal (hybrid approach)
- ❌ More complex architecture
- ❌ May break TUI flow

### Best For
- **Full interactivity** (your requirement!)
- Complex web apps
- Rich artifacts
- Best UX

---

## Solution 7: **@opentui/core Built-in Capabilities** ⭐⭐⭐⭐⭐

### What We Know
From package.json:
```json
"@opentui/core": "0.1.79"
```

Dependencies include:
- **jimp**: Image processing library
- **yoga-layout**: Layout engine (Flexbox)
- **diff**: Diff rendering
- **marked**: Markdown rendering

### Likely Capabilities (based on dependencies)
- ✅ Image display (jimp integration)
- ✅ Markdown rendering (marked)
- ✅ Diff views (diff library)
- ✅ Flexible layouts (yoga)
- ❓ Terminal graphics protocol support
- ❓ WebView embedding

### Research Needed
Check `@opentui/core` documentation for:
1. Does it support kitty/sixel/iTerm2 protocols?
2. Can it embed images natively?
3. Does it have WebView component?
4. What's the image API?

### Best For
- Native integration
- No additional dependencies
- Consistent API

---

## Recommendation Matrix

| Solution | Browser | Artifacts | Interactive | Compatibility | Complexity | Overall |
|----------|---------|-----------|-------------|---------------|------------|---------|
| **Kitty Protocol** | ⭐⭐⭐ (screenshot) | ⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Sixel** | ⭐⭐⭐ | ⭐⭐⭐ | ❌ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **iTerm2** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **ASCII** | ⭐ | ⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Screenshot+Browser** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Embedded WebView** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **@opentui native** | ? | ? | ? | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ? |

---

## **RECOMMENDED APPROACH: Hybrid Multi-Layer Strategy**

### Layer 1: **@opentui/core Native** (Primary)
- Use built-in image support if available
- Check documentation first
- Leverage jimp integration we already have

### Layer 2: **Kitty/iTerm2 Protocol** (Fallback for macOS)
- Since you're on macOS, iTerm2 protocol is perfect
- Implement both kitty and iTerm2
- Auto-detect terminal and use best protocol

### Layer 3: **Screenshot + Headless Browser** (For Web Content)
- Use Puppeteer/Playwright for web previews
- Capture screenshot → display via kitty/iTerm2
- Keyboard navigation (click links, submit forms)

### Layer 4: **Embedded WebView** (For Full Interactivity)
- When full interaction needed
- Open browser window alongside TUI
- Control from TUI via IPC

### Layer 5: **ASCII Fallback** (Universal)
- When no graphics protocol supported
- Quick previews
- Maximum compatibility

---

## Implementation Plan

### Phase 1: Research @opentui/core (1-2 days)
- [ ] Read documentation
- [ ] Check image display API
- [ ] Test with sample images
- [ ] Verify jimp integration

### Phase 2: Implement Basic Image Display (2-3 days)
- [ ] Add kitty protocol support
- [ ] Add iTerm2 protocol support (for you!)
- [ ] Auto-detect terminal type
- [ ] Test with PNG/JPEG

### Phase 3: Web Preview (3-5 days)
- [ ] Integrate Puppeteer
- [ ] Screenshot capture
- [ ] Display in viewport
- [ ] Keyboard navigation

### Phase 4: Artifact Display (2-3 days)
- [ ] File preview component
- [ ] Markdown rendering (use marked!)
- [ ] Diff views (use diff library!)
- [ ] Image gallery

### Phase 5: Full Interactivity (5-7 days)
- [ ] Embedded WebView or
- [ ] Browser window integration
- [ ] Mouse/keyboard passthrough
- [ ] State sync

---

## Next Steps

1. **Check @opentui/core docs** - What does it support natively?
2. **Test terminal** - Are you using iTerm2 or kitty?
3. **Prioritize** - Start with iTerm2 protocol (macOS native)
4. **Build MVP** - Image display → Web screenshots → Full interactivity

---

## Questions for You

1. **What terminal are you using?** (iTerm2, kitty, Terminal.app, other?)
2. **Is iTerm2 acceptable?** (best macOS support)
3. **Do you want hybrid (TUI + browser window) or pure TUI?**
4. **Priority order**: Browser previews or artifacts first?
