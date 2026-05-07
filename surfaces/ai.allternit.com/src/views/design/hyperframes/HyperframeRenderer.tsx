import React from 'react';
import { motion } from 'framer-motion';

interface HyperframeProps {
  layout: 'flex' | 'grid' | 'stack';
  padding: number;
  gap: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Hyperframe Renderer
 * 
 * Inspired by Cult-UI / Hyperframes.
 * A frame-perfect layout engine that ensures strict visual fidelity.
 */
export const Hyperframe: React.FC<HyperframeProps> = ({
  layout,
  padding,
  gap,
  align = 'stretch',
  children,
  style
}) => {
  const layoutStyles: React.CSSProperties = {
    display: layout === 'grid' ? 'grid' : 'flex',
    flexDirection: layout === 'stack' ? 'column' : 'row',
    gridTemplateColumns: layout === 'grid' ? `repeat(auto-fit, minmax(0, 1fr))` : undefined,
    padding: `${padding}px`,
    gap: `${gap}px`,
    alignItems: align,
    width: '100%',
    ...style
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={layoutStyles}
    >
      {children}
    </motion.div>
  );
};

export default Hyperframe;
