# Phase 5 Implementation: Export Utilities & Advanced Features

## Overview
Phase 5 adds export capabilities, presentation remote control, and advanced citation features with browser screenshot support.

## New Components

### 1. Export Utilities (`utils/ExportUtilities.ts`)
Comprehensive export system supporting multiple formats:

**ResearchDoc Exports:**
- `exportToMarkdown()` - Convert research docs to Markdown with citation links
- `exportToHTML()` - Generate standalone HTML documents with styling
- `exportToPDF()` - Print-to-PDF functionality
- `downloadMarkdown()`, `downloadHTML()` - Direct file downloads

**DataGrid Exports:**
- `exportToCSV()` - CSV format with proper escaping
- `exportToJSON()` - Structured JSON with metadata
- `exportToExcelHTML()` - Excel-compatible HTML tables
- `downloadCSV()`, `downloadJSON()`, `downloadExcel()` - Direct downloads

**Presentation Exports:**
- `exportPresentationToMarkdown()` - Outline format
- `exportPresentationToPDF()` - Slide-by-slide print view

**React Hook:**
- `useExport(programId)` - Hook for programmatic exports

### 2. Presentation Remote Control (`programs/PresentationRemote.tsx`)
Full-featured remote control interface:

**Features:**
- QR code generation for mobile remote access
- Timer with pause/reset
- Progress bar showing slide completion
- Quick jump to any slide via numbered grid
- Keyboard shortcuts (arrows, space, home/end, escape)
- Speaker notes view with "Up Next" preview
- Settings panel with configuration options

**Keyboard Shortcuts:**
- `→ ↓ Space` - Next slide
- `← ↑` - Previous slide
- `Home/End` - First/Last slide
- `ESC` - Close remote

### 3. Browser Screenshot Citations (`programs/BrowserScreenshotCitations.tsx`)
Advanced citation system with visual evidence:

**Features:**
- Automatic webpage screenshot capture
- Visual evidence library management
- Screenshot annotation tools (highlight regions)
- Citation verification (check if URLs still accessible)
- Integration with ResearchDoc evidence system

**Workflow:**
1. Enter URL to capture
2. Screenshot is generated (via browser automation)
3. Add annotations/highlighting
4. Create citation with visual evidence
5. Verify citations periodically

### 4. Presentation Program Updates (`programs/PresentationProgram.tsx`)
Enhanced presentation viewer with:

**Features:**
- Slide navigation with thumbnails
- Multiple themes (default, dark, blue, gradient, minimal)
- Presenter notes panel
- Fullscreen mode (F key)
- Remote control integration
- Keyboard navigation
- Slide type support: title, content, two-column, image, code

**Integration:**
- Launches PresentationRemote via button
- Syncs with store for slide state
- Exports via new utilities

### 5. ResearchDoc Program Updates (`programs/ResearchDocProgram.tsx`)
Updated with export and citation features:

**New UI Elements:**
- Export menu (Markdown, HTML, PDF)
- Citation Manager button
- Enhanced citation popovers with source preview
- Evidence cards with zoom functionality

## Integration Points

### Store Integration
All components use `useSidecarStore` for state management:
```typescript
const store = useSidecarStore();
store.updateProgramState<PresentationState>(programId, (prev) => ({
  ...prev,
  currentSlideIndex: newIndex,
}));
```

### Export Menu in ResearchDoc
Located in top-right corner with dropdown:
- Download Markdown (.md)
- Download HTML (.html)
- Print / Save PDF

### Citation Manager Button
Opens BrowserScreenshotCitations for:
- Capturing webpage screenshots
- Managing visual evidence
- Creating citations with sources

## Usage Examples

### Export a Research Document
```typescript
import { useExport } from '../utils/ExportUtilities';

function MyComponent() {
  const { exportDocument } = useExport(programId);
  
  return (
    <button onClick={() => exportDocument('markdown')}>
      Export to Markdown
    </button>
  );
}
```

### Launch Presentation Remote
```typescript
const [showRemote, setShowRemote] = useState(false);

{showRemote && (
  <PresentationRemote
    programId={program.id}
    onClose={() => setShowRemote(false)}
  />
)}
```

### Capture Screenshot Citation
```typescript
import { CitationManager } from '../programs/BrowserScreenshotCitations';

<CitationManager programId={programId} />
```

## File Structure
```
utils/
  ExportUtilities.ts       # Export functions and hooks
  FileSystemWatcher.ts     # File watching utilities
  index.ts                 # Central exports

programs/
  ResearchDocProgram.tsx   # Updated with export menu
  PresentationProgram.tsx  # New full implementation
  PresentationRemote.tsx   # Remote control modal
  BrowserScreenshotCitations.tsx  # Citation manager
  DataGridProgram.tsx      # Updated with exports

components/
  A2rCanvas.tsx            # Updated imports
```

## Next Steps

### Phase 6 Candidates:
1. **Telephony Integration** - Vapi.ai/Twilio phone calls
2. **ImageStudio Canvas** - Masking and inpainting tools
3. **AudioStudio TTS** - ElevenLabs/OpenAI voice generation
4. **Advanced Browser** - Full embedded browser with automation
5. **Kernel Performance** - Optimization and caching

## Testing Checklist
- [ ] Export ResearchDoc to Markdown/HTML/PDF
- [ ] Export DataGrid to CSV/JSON/Excel
- [ ] Presentation keyboard navigation
- [ ] Presentation remote control QR code
- [ ] Screenshot citation capture
- [ ] Citation verification
- [ ] Theme switching in presentations
- [ ] Fullscreen mode
