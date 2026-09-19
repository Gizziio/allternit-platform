import React from 'react';
import { Box, Text } from '../../ink';
import type { Workflow } from './types';
interface CreatingStepProps {
  currentWorkflowInstallStep: number;
  secretExists: boolean;
  useExistingSecret: boolean;
  secretName: string;
  skipWorkflow?: boolean;
  selectedWorkflows: Workflow[];
}
export function CreatingStep(t0) {
  const {
    currentWorkflowInstallStep,
    secretExists,
    useExistingSecret,
    secretName,
    skipWorkflow: t1,
    selectedWorkflows
  } = t0;
  const skipWorkflow = t1 === undefined ? false : t1;
  const t2 = skipWorkflow ? ["Getting repository information", secretExists && useExistingSecret ? "Using existing API key secret" : `Setting up ${secretName} secret`] : ["Getting repository information", "Creating branch", selectedWorkflows.length > 1 ? "Creating workflow files" : "Creating workflow file", secretExists && useExistingSecret ? "Using existing API key secret" : `Setting up ${secretName} secret`, "Opening pull request page"];

  const progressSteps = t2;
  const t3 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text><Text dimColor={true}>Create GitHub Actions workflow</Text></Box>;

  const t4 = <><Box flexDirection="column" borderStyle="round" paddingX={1}>{t3}{progressSteps.map((stepText, index) => {
          let status = "pending";
          if (index < currentWorkflowInstallStep) {
            status = "completed";
          } else {
            if (index === currentWorkflowInstallStep) {
              status = "in-progress";
            }
          }
          return <Box key={index}><Text color={status === "completed" ? "success" : status === "in-progress" ? "warning" : undefined}>{status === "completed" ? "\u2713 " : ""}{stepText}{status === "in-progress" ? "\u2026" : ""}</Text></Box>;
        })}</Box></>;

  return t4;
}
