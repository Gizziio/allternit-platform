import React from 'react';
import { Renderer } from '@openuidev/react-lang';
import { componentRegistry, schemas } from './registry';

interface AllternitOpenUIRendererProps {
  stream: string;
  className?: string;
}

/**
 * AllternitOpenUIRenderer
 * 
 * A wrapper around OpenUI's Renderer that uses Allternit's 
 * design system components and glass aesthetic.
 */
export const AllternitOpenUIRenderer: React.FC<AllternitOpenUIRendererProps> = ({ 
  stream,
  className 
}) => {
  return (
    <div className={className}>
      <Renderer 
        response={stream}
        library={componentRegistry as any}
      />
    </div>
  );
};

export default AllternitOpenUIRenderer;
