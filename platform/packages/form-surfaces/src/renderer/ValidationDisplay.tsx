import React from 'react';
import type { FormValidationError } from '../schema';

interface ValidationDisplayProps {
  errors: FormValidationError[];
}

export const ValidationDisplay: React.FC<ValidationDisplayProps> = ({ errors }) => {
  if (!errors.length) return null;
  return (
    <div role="alert">
      {errors.map((error) => (
        <div key={error.fieldId + error.rule}>
          {error.message}
        </div>
      ))}
    </div>
  );
}
