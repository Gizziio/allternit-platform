// Mock API implementation for capsule compilation
// This would typically be implemented in the backend services

interface EvidenceObject {
  evidenceId: string;
  kind: string;
  title: string;
  uri?: string;
  favicon?: string;
  snapshotRef?: string;
  extractedSchema: any;
  metadata: any;
  extractionStatus: string;
  pinState: string;
  freshness: string;
  confidence: number;
}

interface CanvasSpec {
  canvasId: string;
  title: string;
  views: any[];
}

interface CompileRequest {
  evidence: EvidenceObject[];
  goal: string;
}

interface CompileResponse {
  canvasSpec: CanvasSpec;
}

// Mock compilation logic based on evidence and goal
export const mockCompileCapsule = (request: CompileRequest): CompileResponse => {
  const { evidence, goal } = request;
  
  // Determine canvas type based on goal
  let viewType = 'list_view';
  let title = goal || 'New Capsule';
  
  if (goal.toLowerCase().includes('plan') || goal.toLowerCase().includes('trip')) {
    viewType = 'form_view';
    title = 'Trip Planning Canvas';
  } else if (goal.toLowerCase().includes('research') || goal.toLowerCase().includes('study')) {
    viewType = 'graph_view';
    title = 'Research Canvas';
  } else if (goal.toLowerCase().includes('diff') || goal.toLowerCase().includes('review')) {
    viewType = 'table_view';
    title = 'Diff Review Canvas';
  } else if (evidence.length > 3) {
    viewType = 'cards_view';
    title = 'Multi-Evidence Canvas';
  }
  
  // Create views based on evidence types
  const views = [];
  
  // Main view based on goal type
  views.push({
    viewId: `main-${Date.now()}`,
    type: viewType,
    title: title,
    data: {
      evidenceCount: evidence.length,
      goal: goal,
      evidenceTypes: [...new Set(evidence.map(e => e.kind))]
    }
  });
  
  // Add evidence list view if there's evidence
  if (evidence.length > 0) {
    views.push({
      viewId: `evidence-${Date.now()}`,
      type: 'list_view',
      title: 'Evidence',
      data: {
        items: evidence.map(e => ({
          id: e.evidenceId,
          title: e.title,
          type: e.kind,
          uri: e.uri
        }))
      }
    });
  }
  
  // Add actions view
  views.push({
    viewId: `actions-${Date.now()}`,
    type: 'form_view',
    title: 'Actions',
    data: {
      availableActions: [
        { id: 'synthesize', label: 'Synthesize Information' },
        { id: 'export', label: 'Export Results' },
        { id: 'refine', label: 'Refine Query' }
      ]
    }
  });
  
  return {
    canvasSpec: {
      canvasId: `canvas-${Date.now()}`,
      title: title,
      views: views
    }
  };
};