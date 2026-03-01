import { CanvasSpec } from '../../shared/contracts';

export interface InteractionSpec {
  transition: 'push' | 'modal' | 'fade' | 'shared_element_push';
  importance: 'light' | 'normal' | 'heavy';
  recommendedActions: string[];
}

export class PresentationKernel {
  resolveInteraction(fromView: string | null, toView: string): InteractionSpec {
    // Logic from Architecture/UI/PresentationKernel.md
    if (!fromView) return { transition: 'fade', importance: 'normal', recommendedActions: [] };

    if (fromView === 'table_view' && toView === 'record_view') {
      return { transition: 'shared_element_push', importance: 'heavy', recommendedActions: ['escalate', 'close'] };
    }

    if (toView === 'artifact_view' || toView === 'diff_view') {
      return { transition: 'modal', importance: 'light', recommendedActions: [] };
    }

    if (toView === 'policy_view') {
      return { transition: 'fade', importance: 'normal', recommendedActions: [] };
    }

    return { transition: 'push', importance: 'normal', recommendedActions: [] };
  }
}
