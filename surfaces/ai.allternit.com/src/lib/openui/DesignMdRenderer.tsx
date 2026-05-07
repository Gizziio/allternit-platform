import React, { useMemo } from 'react';
import { AllternitOpenUIRenderer } from './AllternitOpenUIRenderer';
import { parseDesignMd, tokensToCssVars } from './design-md-parser';

interface DesignMdRendererProps {
  designMd: string;
  uiStream: string;
  className?: string;
}

/**
 * DesignMdRenderer
 * 
 * Takes a DESIGN.md specification and an OpenUI Lang stream.
 * It parses the markdown, extracts the design tokens, converts them to CSS vars,
 * and applies them to a wrapper around the AllternitOpenUIRenderer.
 * 
 * This enables the "Claude Design on Steroids" workflow where an agent
 * can dynamically re-skin an interface on the fly.
 */
export const DesignMdRenderer: React.FC<DesignMdRendererProps> = ({ 
  designMd, 
  uiStream,
  className = ''
}) => {
  const cssVars = useMemo(() => {
    const tokens = parseDesignMd(designMd);
    return tokensToCssVars(tokens);
  }, [designMd]);

  return (
    <div 
      className={`design-md-container ${className}`} 
      style={cssVars}
    >
      {/* 
        The AllternitOpenUIRenderer and its underlying components (from registry.tsx)
        must be updated to consume these CSS variables (e.g., var(--design-color-primary))
        for this to fully work. For now, it provides the wrapper.
      */}
      <AllternitOpenUIRenderer stream={uiStream} />
    </div>
  );
};

export default DesignMdRenderer;
