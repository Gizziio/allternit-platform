/**
 * GitHub App installation types
 * TEMPORARY SHIM
 */

export interface GitHubAppConfig {
  appId: string
  installationId?: string
  privateKey?: string
}

export interface InstallationStep {
  name: string
  status: 'pending' | 'in-progress' | 'complete' | 'error'
  message?: string
}

export interface Workflow {
  id: string
  name: string
  steps: InstallationStep[]
}

export interface State {
  step: string
  selectedRepoName: string
  currentRepo: string
  useCurrentRepo: boolean
  apiKeyOrOAuthToken: string
  useExistingKey: boolean
  currentWorkflowInstallStep: number
  warnings: Warning[]
  secretExists: boolean
  secretName: string
  useExistingSecret: boolean
  workflowExists: boolean
  selectedWorkflows: Workflow[]
  selectedApiKeyOption: 'existing' | 'new' | 'oauth'
  authType: string
  config?: GitHubAppConfig
  workflowAction?: string
  error?: string
  errorReason?: string
  errorInstructions?: string[]
}

export interface Warning {
  message: string
  severity?: 'info' | 'warning' | 'error'
  title?: string
  instructions?: string[]
}
