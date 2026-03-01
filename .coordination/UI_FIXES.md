# UI Fixes - Analysis & Solutions

## Current Issues Identified

### 1. Chat Input Position
The ChatView has the input at the bottom in code (lines 1458-1496), but it may not be rendering correctly due to:
- Missing CSS variable definitions
- Flexbox layout issues
- Parent container not having proper height

### 2. Missing CSS Variables
The theme.css exists but may not be properly imported in the app entry point.

### 3. 3-Mode System (Chat/Cowork/Code)
The ChatView accepts a `mode` prop (line 1095) with values 'chat' | 'cowork' | 'code', but:
- The mode switching UI is not implemented
- The rail configs exist but need proper integration
- Mode-specific suggestions are defined but not fully utilized

### 4. Left Rail Organization
The ShellRail uses different configs:
- `RAIL_CONFIG` for chat mode
- `COWORK_RAIL_CONFIG` for cowork mode  
- `CODE_RAIL_CONFIG` for code mode

But these need to be better organized and styled.

## Fix Plan

### Phase 1: CSS & Layout Fixes
1. Ensure theme.css is imported in the app
2. Fix flexbox layout for chat input positioning
3. Add proper height/overflow handling

### Phase 2: 3-Mode System
1. Create mode switcher component
2. Wire up mode state to ShellRail
3. Implement mode-specific UI variations

### Phase 3: Rail Organization
1. Reorganize left rail tabs
2. Add proper icons and labels
3. Implement collapsible sections

### Phase 4: Production Polish
1. Add loading states
2. Fix spacing throughout
3. Ensure dark mode works
4. Add error boundaries
