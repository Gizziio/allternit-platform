/**
 * @fileoverview Step Layout Component
 * 
 * Reusable step layout component with consistent styling,
 * navigation buttons, and accessibility features.
 * 
 * @module components/onboarding/components/Step
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Button } from './Button';

/**
 * Props for the Step component
 */
export interface StepProps {
  /** Step title */
  title: string;
  /** Step description */
  description?: string;
  /** Child components */
  children: React.ReactNode;
  /** Callback to go back */
  onBack?: () => void;
  /** Callback to go next */
  onNext?: () => void;
  /** Label for the next button */
  nextLabel?: string;
  /** Whether the next button is disabled */
  isNextDisabled?: boolean;
  /** Whether to show navigation buttons */
  showNavigation?: boolean;
  /** Whether to show the next button */
  showNext?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Step layout component
 * 
 * Provides a consistent layout for all wizard steps with:
 * - Header with title and description
 * - Content area
 * - Navigation buttons (optional)
 * - Smooth animations
 * 
 * @param props - Component props
 * @returns {JSX.Element} Step layout component
 */
export function Step({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  isNextDisabled = false,
  showNavigation = true,
  showNext = true,
  className = '',
}: StepProps): JSX.Element {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {description && (
          <p className="text-gray-400">{description}</p>
        )}
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {children}
      </motion.div>

      {/* Navigation */}
      {showNavigation && (onBack || (showNext && onNext)) && (
        <motion.div
          className="flex items-center justify-between pt-4 border-t border-gray-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {/* Back button */}
          <div>
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack}
                aria-label="Go back to previous step"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          {/* Next button */}
          <div>
            {showNext && onNext && (
              <Button
                variant="primary"
                onClick={onNext}
                disabled={isNextDisabled}
                aria-label={nextLabel}
              >
                {nextLabel}
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
