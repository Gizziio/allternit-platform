/**
 * Environment Wizard Usage Example
 * 
 * This file demonstrates how to use the EnvironmentWizard component.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EnvironmentWizard } from './EnvironmentWizard';
import type { Environment } from '@/api/infrastructure/environments';

// Example 1: Basic Usage
export function EnvironmentWizardExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = (environment: Environment) => {
    console.log('Environment created:', environment);
    // Navigate to the environment, update UI, etc.
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Create New Environment
      </Button>

      <EnvironmentWizard
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}

// Example 2: With Pre-selected Template
export function EnvironmentWizardWithTemplate() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Create A2R Platform Environment
      </Button>

      <EnvironmentWizard
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialTemplateId="a2r-platform-dev"  // Pre-select the A2R platform template
        onSuccess={(env) => {
          console.log('A2R Platform environment ready:', env.url);
        }}
      />
    </>
  );
}

// Example 3: Full Integration in a Page
export function EnvironmentsPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  const handleEnvironmentCreated = (environment: Environment) => {
    setEnvironments(prev => [...prev, environment]);
    setIsWizardOpen(false);
    
    // Show success notification
    // toast.success(`Environment "${environment.name}" is being provisioned`);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Environments</h1>
        <Button onClick={() => setIsWizardOpen(true)}>
          Create Environment
        </Button>
      </div>

      {/* Environment list would go here */}
      <div className="grid grid-cols-3 gap-4">
        {environments.map(env => (
          <div key={env.id} className="p-4 border rounded-lg">
            <h3 className="font-medium">{env.name}</h3>
            <p className="text-sm text-muted-foreground">{env.status}</p>
          </div>
        ))}
      </div>

      <EnvironmentWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleEnvironmentCreated}
      />
    </div>
  );
}

// Example 4: Controlled Wizard with External State
export function ControlledEnvironmentWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSuccess = async (environment: Environment) => {
    setIsCreating(true);
    
    try {
      // Additional setup after environment creation
      // await setupEnvironment(environment.id);
      
      setIsOpen(false);
      // Redirect to environment dashboard
      // router.push(`/environments/${environment.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <EnvironmentWizard
      isOpen={isOpen}
      onClose={() => !isCreating && setIsOpen(false)}
      onSuccess={handleSuccess}
    />
  );
}

export default EnvironmentWizardExample;
