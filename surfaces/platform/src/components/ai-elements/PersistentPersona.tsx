"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Persona, PersonaState } from './persona';

interface PersistentPersonaProps {
  state: PersonaState;
  anchorElement: HTMLElement | null;
  isVisible: boolean;
  size?: number;
  className?: string;
  energy?: number;
}

/**
 * PersistentPersona - A single persona that "flows" to its target position.
 * Uses the MatrixLogo monolith (gizzi variant) as the A2R brand identity.
 * This avoids multiple persona instances in the chat list.
 */
export const PersistentPersona = ({
  state,
  anchorElement,
  isVisible,
  size = 32,
  className,
  energy = 0
}: PersistentPersonaProps) => {
  const [coords, setCoords] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    if (!isVisible || !anchorElement) return;

    const updatePosition = () => {
      if (!anchorElement) return;
      const rect = anchorElement.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    };

    updatePosition();
    const interval = setInterval(updatePosition, 16); // High frequency for smooth flow during scroll

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, anchorElement, state]);

  return (
    <div
      className="fixed pointer-events-none z-[100]"
      style={{
        left: coords.x,
        top: coords.y,
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 150 }}
            style={{
              // Ensure the monolith renders with proper depth and visibility
              transformStyle: 'preserve-3d',
              perspective: '1000px'
            }}
          >
            <Persona
              variant="gizzi"
              state={state}
              size={size}
              className={className}
              animateWithEnergy={true}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
