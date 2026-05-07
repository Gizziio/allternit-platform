# Capsule Browser Roadmap & Component Registry

## Current Implementation Status

### ✅ Implemented Components (v1.0)

| Category | Components | Status |
|----------|-----------|--------|
| **Layout** | Container, Stack, Grid | ✅ Complete |
| **Content** | Text, Card, Image, Code | ✅ Complete |
| **Input** | Button, TextField, Select, Switch, Checkbox, RadioGroup, Slider | ✅ Complete |
| **Data** | List, DataTable, Badge, Progress, Spinner | ✅ Complete |
| **Navigation** | Tabs, Accordion, Breadcrumbs, Pagination, Menu | ✅ Complete |
| **Feedback** | Alert, Dialog, Tooltip, Popover | ✅ Complete |

---

## Phase 1: High-Priority Components (Next Sprint)

### 🔴 1. Chart/Graph Component

**Use Case:** Data visualization, analytics dashboards, metrics display

**Proposed API:**
```typescript
{
  type: 'Chart',
  props: {
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    data: Array<{ x: number | string; y: number; label?: string }> | string; // data path
    dataPath?: string; // For dynamic data
    xAxis?: { label?: string; type: 'category' | 'number' | 'time' };
    yAxis?: { label?: string; min?: number; max?: number };
    colors?: string[];
    legend?: boolean;
    tooltip?: boolean;
    onPointClick?: string; // Action ID
    height?: number;
    animated?: boolean;
  }
}
```

**Implementation Notes:**
- Use `recharts` or `chart.js` for rendering
- Support responsive sizing
- Allow data updates via dataModel binding
- Export chart as image action

**Files to Create:**
- `src/capsules/a2ui/components/ChartRenderer.tsx`
- Add to `a2ui.types.ts`
- Add to `A2UIRenderer.tsx` switch statement

---

### 🔴 2. Calendar/DatePicker Component

**Use Case:** Scheduling, date selection, event planning

**Proposed API:**
```typescript
{
  type: 'DatePicker',
  props: {
    label?: string;
    valuePath: string; // ISO date string or Date object
    mode?: 'single' | 'range' | 'multiple';
    minDate?: string;
    maxDate?: string;
    disabledDates?: string[] | string; // data path
    showTime?: boolean;
    timeFormat?: '12h' | '24h';
    disabled?: boolean | string;
  }
}

{
  type: 'Calendar',
  props: {
    valuePath: string;
    events?: Array<{
      date: string;
      title: string;
      color?: string;
      action?: string;
    }> | string; // data path
    mode?: 'month' | 'week' | 'day';
    onDateClick?: string;
    onEventClick?: string;
  }
}
```

**Implementation Notes:**
- Use `date-fns` for date manipulation
- Support timezone handling
- Event overlays for calendar view
- Range selection visual feedback

---

### 🔴 3. FileUpload Component

**Use Case:** Document upload, image upload, drag-drop interfaces

**Proposed API:**
```typescript
{
  type: 'FileUpload',
  props: {
    label?: string;
    valuePath: string; // Array of uploaded file objects
    accept?: string; // '.pdf,.jpg' or 'image/*'
    multiple?: boolean;
    maxSize?: number; // bytes
    maxFiles?: number;
    dragDrop?: boolean;
    preview?: boolean; // Show image previews
    uploadAction?: string; // Action to trigger upload
    onUploadProgress?: string;
    onUploadComplete?: string;
    onUploadError?: string;
  }
}
```

**Implementation Notes:**
- Drag overlay state
- Progress indicators per file
- Preview generation for images
- Validation (size, type)
- Chunked upload for large files
- Integration with storage API

---

## Phase 2: Medium-Priority Components

### 🟡 4. RichText / MarkdownEditor

**Use Case:** Formatted text input, document editing

```typescript
{
  type: 'RichText',
  props: {
    label?: string;
    valuePath: string;
    placeholder?: string;
    minHeight?: number;
    maxHeight?: number;
    toolbar?: Array<'bold' | 'italic' | 'link' | 'code' | 'list'>;
    mode?: 'markdown' | 'wysiwyg';
    onChange?: string;
  }
}
```

---

### 🟡 5. TreeView

**Use Case:** File trees, nested categories, org charts

```typescript
{
  type: 'TreeView',
  props: {
    items: Array<TreeNode> | string; // data path
    selectionPath?: string;
    expandedPaths?: string[];
    onSelect?: string;
    onExpand?: string;
    onCollapse?: string;
    draggable?: boolean;
    onDrop?: string;
    renderIcon?: (node: TreeNode) => string;
  }
}

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  icon?: string;
  expandable?: boolean;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}
```

---

### 🟡 6. SplitPane

**Use Case:** Resizable panels (VS Code style), side-by-side views

```typescript
{
  type: 'SplitPane',
  props: {
    direction: 'horizontal' | 'vertical';
    sizes: number[]; // Percentages or pixels
    minSize?: number | number[];
    maxSize?: number | number[];
    children: ComponentNode[]; // Must match sizes length
    resizable?: boolean;
    onResize?: string;
  }
}
```

---

### 🟡 7. Timeline

**Use Case:** Process flows, git history, activity feeds

```typescript
{
  type: 'Timeline',
  props: {
    items: Array<TimelineItem> | string;
    mode?: 'vertical' | 'horizontal';
    alignment?: 'left' | 'right' | 'alternate';
    onItemClick?: string;
  }
}

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: string;
  color?: string;
  status?: 'pending' | 'active' | 'completed' | 'error';
}
```

---

## Phase 3: Enhanced Interactions

### Animation Support

```typescript
// Add to BaseComponentProps
interface BaseComponentProps {
  // ... existing
  animateIn?: 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'none';
  animateOut?: 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'none';
  animateDuration?: number; // ms
  animateDelay?: number; // ms
  animateStagger?: number; // For children (ms)
}
```

**Implementation:** Use `framer-motion` for animations

---

### Enhanced Conditional Visibility

```typescript
interface EnhancedVisibleCondition {
  // Simple conditions
  path?: string;
  eq?: unknown;
  ne?: unknown;
  gt?: number;
  lt?: number;
  contains?: string;
  
  // Complex logic
  and?: EnhancedVisibleCondition[];
  or?: EnhancedVisibleCondition[];
  not?: EnhancedVisibleCondition;
}

// Example usage
{
  type: 'Button',
  props: {
    label: 'Submit',
    visibleWhen: {
      and: [
        { path: 'form.name', ne: '' },
        { path: 'form.email', contains: '@' },
        { or: [
          { path: 'user.role', eq: 'admin' },
          { path: 'user.verified', eq: true }
        ]}
      ]
    }
  }
}
```

---

### Auto-refresh Data Sources

```typescript
interface DataSourceConfig {
  pollInterval?: number; // ms, 0 = no polling
  onError?: string; // Action ID
  retryCount?: number;
  retryDelay?: number;
  cacheDuration?: number;
}

// Add to components that fetch data
interface DataTableProps extends BaseComponentProps {
  // ... existing
  dataSource?: DataSourceConfig;
}
```

---

## Phase 4: Agent-Specific Components

### AgentThinking Component

```typescript
{
  type: 'AgentThinking',
  props: {
    status: 'idle' | 'reasoning' | 'searching' | 'coding' | 'waiting';
    steps?: Array<{
      id: string;
      label: string;
      status: 'pending' | 'active' | 'completed' | 'error';
      detail?: string;
    }> | string; // data path
    showSparkles?: boolean;
    collapsible?: boolean;
    expandedPath?: string;
  }
}
```

**Visual:** Animated dots, progress steps, expandable details

---

### ToolCall Component

```typescript
{
  type: 'ToolCall',
  props: {
    tool: string;
    toolIcon?: string;
    input: Record<string, unknown> | string; // data path
    output?: Record<string, unknown> | string; // data path
    status: 'pending' | 'running' | 'success' | 'error';
    duration?: number; // ms
    expanded?: boolean;
    expandable?: boolean;
    onRerun?: string; // Action ID
  }
}
```

**Visual:** Collapsible card showing tool name, input params, output results

---

### ArtifactPreview Component

```typescript
{
  type: 'ArtifactPreview',
  props: {
    type: 'code' | 'diagram' | 'image' | 'markdown' | 'json' | 'html';
    content: string | string; // data path
    language?: string; // for code type
    filename?: string;
    downloadAction?: string;
    copyAction?: string;
    fullscreenAction?: string;
    height?: number;
  }
}
```

---

## Phase 5: Layout Improvements

### ResponsiveContainer

```typescript
{
  type: 'ResponsiveContainer',
  props: {
    breakpoints: {
      mobile?: { maxWidth: 640; direction: 'column' | 'row'; stack: boolean };
      tablet?: { maxWidth: 1024; columns?: number; direction?: 'column' | 'row' };
      desktop?: { columns?: number; direction?: 'column' | 'row' };
    };
    children: ComponentNode[];
  }
}
```

---

### DockPanel

```typescript
{
  type: 'DockPanel',
  props: {
    position: 'top' | 'bottom' | 'left' | 'right';
    size: number; // pixels or percentage
    resizable?: boolean;
    collapsible?: boolean;
    collapsed?: boolean | string; // data path
    onCollapse?: string;
    onResize?: string;
    header?: ComponentNode;
    children: ComponentNode[];
  }
}
```

---

## Implementation Checklist

### For Each New Component:

- [ ] Add type definition to `a2ui.types.ts`
- [ ] Create renderer in `a2ui/components/` (or inline in `A2UIRenderer.tsx`)
- [ ] Add to `COMPONENT_WHITELIST`
- [ ] Add to `A2UIRenderer.tsx` switch statement
- [ ] Add styling (Tailwind classes)
- [ ] Add Radix UI primitives if needed
- [ ] Test with sample payload
- [ ] Document in README

### Dependencies to Add:

```json
{
  "recharts": "^2.x",           // For charts
  "date-fns": "^3.x",           // Already have, for dates
  "react-dropzone": "^14.x",    // For file upload
  "@uiw/react-md-editor": "^4.x" // For rich text (optional)
}
```

---

## Testing Sample Payloads

### Chart Example:
```typescript
const chartPayload = {
  version: '1.0.0',
  surfaces: [{
    id: 'dashboard',
    root: {
      type: 'Container',
      props: {
        children: [
          {
            type: 'Chart',
            props: {
              type: 'line',
              dataPath: 'salesData',
              xAxis: { label: 'Month', type: 'category' },
              yAxis: { label: 'Revenue ($)', min: 0 },
              animated: true
            }
          }
        ]
      }
    }
  }],
  dataModel: {
    salesData: [
      { x: 'Jan', y: 4000 },
      { x: 'Feb', y: 3000 },
      { x: 'Mar', y: 5000 },
    ]
  }
};
```

---

## Priority Order for Implementation

1. **Chart** - High demand, clear use case
2. **DatePicker** - Common form need
3. **FileUpload** - Required for document workflows
4. **AgentThinking** - Differentiates agent UI
5. **ToolCall** - Essential for agent transparency
6. **TreeView** - File management
7. **SplitPane** - Complex layouts
8. **RichText** - Advanced forms
9. **Timeline** - Process visualization
10. **ResponsiveContainer** - Mobile support
