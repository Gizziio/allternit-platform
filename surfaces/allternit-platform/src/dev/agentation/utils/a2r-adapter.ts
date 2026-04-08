/**
 * Allternit Adapter for Agentation Output
 * 
 * Wraps Agentation clipboard output with Allternit execution context
 * for DAG-ready work items.
 */

import type { AnnotationOutput, AllternitExecutionHeader, AllternitAnnotationOutput } from '../types';

/**
 * Wrap Agentation output with Allternit execution context
 */
export function formatForAllternit(
  output: AnnotationOutput,
  header: AllternitExecutionHeader
): AllternitAnnotationOutput {
  const formattedForAgent = formatAgentInstructions(output, header);
  
  return {
    ...output,
    header,
    formattedForAgent,
  };
}

/**
 * Format as copy/paste ready instructions for Allternit coding agent
 */
function formatAgentInstructions(
  output: AnnotationOutput,
  header: AllternitExecutionHeader
): string {
  return `
# Allternit UI Annotation → Agent Instructions

## Execution Context
| Field | Value |
|-------|-------|
| **UI Surface** | ${header.uiSurface} |
| **Story** | ${header.storyId || 'N/A'} (${header.storyName || 'Unnamed'}) |
| **Component** | ${header.componentPath || 'N/A'} |
| **Renderer** | ${header.renderer} |
| **Viewport** | ${header.viewport.width}x${header.viewport.height}${header.viewport.device ? ` (${header.viewport.device})` : ''} |
| **WIH ID** | ${header.wihId || 'TBD'} |
| **DAG Node** | ${header.dagNodeId || 'TBD'} |

## Acceptance Criteria
${header.acceptance}

---

## Agentation Notes
${output.notes}

## Target Selectors
${output.selectors.map(s => `- \`${s}\``).join('\n')}

## Context
${output.context}

${output.screenshot ? `## Screenshot\n![Annotation](${output.screenshot})\n` : ''}
---

## Agent Action Required

1. **Locate component** using selectors above
2. **Review notes** for desired changes
3. **Implement changes** in component file
4. **Run Storybook** to verify visual changes
5. **Run interaction tests** to verify functionality
6. **Update snapshot** if visual changes are expected

## Verification Commands

\`\`\`bash
# Run Storybook for this component
npm run dev -w @repo/storybook

# Run interaction tests
npm run test:interaction -w @repo/storybook

# Build Storybook (production check)
npm run build -w @repo/storybook
\`\`\`
`.trim();
}

/**
 * Create default Allternit header for Storybook context
 */
export function createDefaultHeader(options?: Partial<AllternitExecutionHeader>): AllternitExecutionHeader {
  return {
    uiSurface: 'primitives',
    storyId: undefined,
    storyName: undefined,
    componentPath: undefined,
    renderer: 'AGENT',
    viewport: {
      width: 1280,
      height: 720,
      device: 'desktop',
    },
    acceptance: 'Storybook build passes + no visual regressions',
    wihId: 'TBD',
    dagNodeId: 'TBD',
    ...options,
  };
}

/**
 * Parse Storybook context from URL
 */
export function parseStorybookContext(url: string): Partial<AllternitExecutionHeader> {
  try {
    const urlObj = new URL(url);
    const pathParams = urlObj.searchParams.get('path');
    
    if (!pathParams) {
      return {};
    }
    
    // Parse story path (e.g., "components-button--primary")
    const parts = pathParams.split('--');
    const storyName = parts[parts.length - 1];
    const componentPath = parts.slice(0, -1).join('/');
    
    return {
      storyId: pathParams,
      storyName: storyName.charAt(0).toUpperCase() + storyName.slice(1),
      componentPath: componentPath.replace(/-/g, '/'),
    };
  } catch {
    return {};
  }
}

/**
 * Get viewport preset from device type
 */
export function getViewportPreset(device: 'desktop' | 'tablet' | 'mobile') {
  switch (device) {
    case 'mobile':
      return { width: 375, height: 667, device: 'mobile' as const };
    case 'tablet':
      return { width: 768, height: 1024, device: 'tablet' as const };
    case 'desktop':
    default:
      return { width: 1280, height: 720, device: 'desktop' as const };
  }
}
