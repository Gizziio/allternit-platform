# UI Component Model

## Core Components

### RunSelector
- Purpose: Select active run or create new run
- Props: runList, onSelect, onCreate
- State: selectedRunId, newRunConfig

### DAGCanvas
- Purpose: Render execution graph visually
- Props: graphData, onNodeClick
- State: zoomLevel, panPosition, selectedNode

### NodeInspector
- Purpose: Display detailed information about selected node
- Props: nodeId, nodeData
- State: expandedSections

### ReceiptViewer
- Purpose: Display receipt details with filtering
- Props: receiptList, filters
- State: activeFilters, selectedReceipt

### ArtifactBrowser
- Purpose: Browse run-scoped artifacts
- Props: runId, artifactPaths
- State: currentPath, viewMode

### ForensicsPanel
- Purpose: Export/replay forensics operations
- Props: runId, onExport, onReplay
- State: exportStatus, replayProgress

### MemoryPromotionPanel
- Purpose: Handle memory candidate promotion
- Props: candidates, onApprove, onReject
- State: selectedCandidate, approvalStatus

## Component Hierarchy
```
App
├── Layout
│   ├── SidebarNav
│   ├── MainContent
│   │   ├── Header
│   │   ├── ContentView
│   │   └── InspectorPane
│   └── StatusBar
└── Modals
    ├── ConfirmationModal
    └── ProgressModal
```