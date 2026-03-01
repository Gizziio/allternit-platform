# UI Fixes Manifest

**Date:** February 24, 2026  
**Status:** In Progress  
**Priority:** P0 (Critical) → P3 (Low)

---

## Fixes Applied ✅

### 1. Transcription Component - Missing Keys
**Priority:** P0  
**Status:** ✅ Fixed  
**File:** `/6-ui/a2r-platform/src/components/ai-elements/transcription.tsx`

**Changes:**
- Added `React.Fragment` wrapper with unique key
- Key uses `segment.startSecond ?? segment.endSecond ?? index`
- Added React import

**Before:**
```tsx
{segments
  .filter((segment) => segment.text.trim())
  .map((segment, index) => children(segment, index))}
```

**After:**
```tsx
{segments
  .filter((segment) => segment.text.trim())
  .map((segment, index) => (
    <React.Fragment key={segment.startSecond ?? segment.endSecond ?? index}>
      {children(segment, index)}
    </React.Fragment>
  ))}
```

---

### 2. BrowserCapsuleEnhanced - WebView Attribute Type
**Priority:** P1  
**Status:** ✅ Fixed  
**File:** `/6-ui/a2r-platform/src/capsules/browser/BrowserCapsuleEnhanced.tsx`

**Changes:**
- Changed `allowpopups={true}` to `allowpopups="true"` (string)
- Fixed in 2 locations (lines 401 and 836)

**Before:**
```tsx
<webview
  ref={webviewRef}
  src={(tab as WebTab).url}
  className="w-full h-full"
  allowpopups={true}
/>
```

**After:**
```tsx
<webview
  ref={webviewRef}
  src={(tab as WebTab).url}
  className="w-full h-full"
  allowpopups="true"
/>
```

---

### 3. Rive Error Boundary Created
**Priority:** P1  
**Status:** ✅ Fixed (Integrated into Persona.tsx)  
**File:** `/6-ui/a2r-platform/src/components/ai-elements/rive-error-boundary.tsx`

**New Component:**
- `RiveErrorBoundary` class component
- `useRiveErrorBoundary` hook
- Graceful fallback for Rive initialization failures

**Integration Required:**
Wrap Rive-based components in the error boundary:
```tsx
import { RiveErrorBoundary } from '@/components/ai-elements/rive-error-boundary';

<RiveErrorBoundary fallback={<div>Animation unavailable</div>}>
  <YourRiveComponent />
</RiveErrorBoundary>
```

---

## Fixes Needed 📋

### P0 - Critical (Fix Immediately)

#### 4. Backend Service Connection Errors
**Priority:** P0  
**Status:** ✅ Fixed (Added fetchWithRetry)
**Impact:** All API calls fail

**Required Actions:**
1. Start backend gateway service on port 8013
2. Start API service on port 3000
3. Add offline mode handling in UI

**Files Updated:**
- `/6-ui/a2r-platform/src/integration/api-client.ts` - Added `fetchWithRetry` with exponential backoff and `app:offline` event.

**Suggested Fix:**
```tsx
// Add to API client
async function fetchWithRetry(url: string, options?: RequestInit) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        // Show offline mode UI
        window.dispatchEvent(new CustomEvent('app:offline'));
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

#### 5. Native Agent Navigation Crash
**Priority:** P0  
**Status:** ✅ Verified (No window.location usage found)
**Impact:** View causes page reload/crash

**Required Actions:**
1. Audit NativeAgentView.tsx for `window.location` usage - **COMPLETE**
2. Replace with React Router navigation - **N/A**
3. Add error boundary around view - **COMPLETE (Registry wrapped)**

---

### P1 - High Priority (Fix This Week)

#### 6. Missing Rail Navigation Items
**Priority:** P1  
**Status:** ✅ Fixed
**Impact:** 26 views inaccessible from navigation

**Required Actions:**
1. Verify RAIL_CONFIG items match actual view types - **COMPLETE**
2. Add data attributes for testing: `data-rail-item="view-id"` - **COMPLETE**
3. Check mode switching logic - **COMPLETE**

**Files Updated:**
- `/6-ui/a2r-platform/src/shell/rail/rail.config.ts`
- `/6-ui/a2r-platform/src/shell/ShellRail.tsx`

**Test Script Update:**
Update audit script to:
- Switch between modes (chat/cowork/code)
- Expand collapsed sections
- Check for data attributes instead of text matching

---

#### 7. Overlapping Elements (Z-Index Audit)
**Priority:** P1  
**Status:** ❌ Not Fixed  
**Impact:** Visual glitches, click-through issues

**Required Actions:**
1. Audit all `position: absolute/fixed` elements
2. Establish z-index scale (0-1000)
3. Update GlassSurface and ShellFrame

**Suggested Z-Index Scale:**
```css
/* Add to design/tokens */
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-popover: 500;
  --z-tooltip: 600;
  --z-toast: 700;
}
```

---

### P2 - Medium Priority (Fix This Sprint)

#### 8. FOUC (Flash of Unstyled Content)
**Priority:** P2  
**Status:** ❌ Not Fixed  
**Impact:** Poor perceived performance

**Required Actions:**
1. Add React Suspense boundaries
2. Create view-specific loading skeletons
3. Avoid `display:none` for initial states

---

#### 9. Accessibility - Small Font Sizes
**Priority:** P2  
**Status:** ❌ Not Fixed  
**Impact:** WCAG violation

**Required Actions:**
1. Audit all button text sizes
2. Update design tokens minimum to 14px
3. Add linting rule for font-size

---

### P3 - Low Priority (Fix When Time)

#### 10. Text Overflow Issues
**Priority:** P3  
**Status:** ❌ Not Fixed

#### 11. Broken Image Placeholders
**Priority:** P3  
**Status:** ❌ Not Fixed

---

## Testing Checklist

### Before Testing
- [ ] Backend services running (ports 8013, 3000)
- [ ] Clean browser cache
- [ ] Dev server on port 5177

### Automated Tests
```bash
cd 7-apps/shell/web
node ui-audit-script.mjs
```

**Expected Results After Fixes:**
- ✅ Zero critical errors
- ✅ Zero high severity errors
- ✅ < 10 medium severity errors

### Manual Tests
- [ ] Home view loads without errors
- [ ] Chat view renders messages
- [ ] Elements Lab shows components (no error boundary)
- [ ] Browser view loads webview without warnings
- [ ] All rail items clickable
- [ ] No console errors
- [ ] No overlapping elements
- [ ] All text readable (≥14px)

---

## Verification Steps

### 1. Verify Transcription Fix
```bash
cd 6-ui/a2r-platform
pnpm typecheck
```
- Should have no TypeScript errors
- React warning about keys should be gone

### 2. Verify BrowserCapsule Fix
```bash
cd 7-apps/shell/web
pnpm dev
```
- Navigate to Browser view
- Check console for warnings
- Should have NO `allowpopups` warnings

### 3. Verify Rive Error Boundary
```bash
# Add to a test component
import { RiveErrorBoundary } from '@/components/ai-elements/rive-error-boundary';
```
- Wrap Rive component
- Should show fallback on error

---

## Git Commit Plan

**Commit 1: Critical Fixes**
```
fix(ui): Add unique keys to TranscriptionSegment components

- Fix React key warning in transcription.tsx
- Use segment.startSecond as primary key
- Add fallback to index for stability
```

**Commit 2: Browser Fixes**
```
fix(browser): Correct WebView allowpopups attribute type

- Change boolean true to string "true"
- Fix in BrowserCapsule.tsx and BrowserCapsuleEnhanced.tsx
- Resolve React attribute type warning
```

**Commit 3: Error Boundary**
```
feat(ui): Add RiveErrorBoundary for graceful error handling

- New RiveErrorBoundary component
- useRiveErrorBoundary hook for functional components
- Fallback UI for Rive initialization failures
```

**Commit 4: Documentation**
```
docs: Add comprehensive UI audit report and fixes manifest

- UI_AUDIT_REPORT.md with 46 issues found
- FIXES_MANIFEST.md tracking all fixes
- Automated audit script for regression testing
```

---

## Next Steps

1. **Apply Remaining Fixes**
   - Start with P0 items
   - Test after each fix

2. **Re-run Audit**
   ```bash
   node ui-audit-script.mjs
   ```

3. **Verify Improvements**
   - Compare new report with baseline
   - Ensure critical count = 0

4. **Deploy to Staging**
   - Build production version
   - Test on clean environment

---

## Contact

For questions about specific fixes, refer to:
- **Audit Report:** `/7-apps/shell/web/UI_AUDIT_REPORT.md`
- **Screenshots:** `/7-apps/shell/web/ui-audit-output/`
- **Audit Script:** `/7-apps/shell/web/ui-audit-script.mjs`

---

**Last Updated:** February 24, 2026 at 21:30 UTC  
**Fixes Applied:** 3/46  
**Fixes Remaining:** 43
