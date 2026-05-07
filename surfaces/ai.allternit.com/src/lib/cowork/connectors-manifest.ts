export interface ConnectorEnvVar {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'devtools' | 'crm' | 'comms' | 'infra';
  icon: string;
  envVars: ConnectorEnvVar[];
  /** Path to compiled entry relative to monorepo root */
  entrypoint: string;
}

export const CONNECTOR_MANIFEST: ConnectorDefinition[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels, search messages, send messages',
    category: 'comms',
    icon: 'slack',
    entrypoint: 'domains/cowork/connectors/slack/dist/index.js',
    envVars: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot Token', required: true, secret: true }],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repos, issues, PRs, Actions workflow runs',
    category: 'devtools',
    icon: 'github',
    entrypoint: 'domains/cowork/connectors/github/dist/index.js',
    envVars: [{ key: 'GITHUB_TOKEN', label: 'Personal Access Token', required: true, secret: true }],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Projects, issues, labels',
    category: 'productivity',
    icon: 'linear',
    entrypoint: 'domains/cowork/connectors/linear/dist/index.js',
    envVars: [
      { key: 'LINEAR_API_KEY', label: 'API Key', required: true, secret: true },
      { key: 'LINEAR_BASE_URL', label: 'Base URL', required: false, secret: false },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Projects, issues (JQL), create/update tickets',
    category: 'productivity',
    icon: 'jira',
    entrypoint: 'domains/cowork/connectors/jira/dist/index.js',
    envVars: [
      { key: 'JIRA_BASE_URL', label: 'Base URL', required: true, secret: false },
      { key: 'JIRA_EMAIL', label: 'Email', required: false, secret: false },
      { key: 'JIRA_API_TOKEN', label: 'API Token', required: false, secret: true },
      { key: 'JIRA_ACCESS_TOKEN', label: 'OAuth Access Token', required: false, secret: true },
      { key: 'JIRA_REFRESH_TOKEN', label: 'OAuth Refresh Token', required: false, secret: true },
      { key: 'JIRA_CLIENT_ID', label: 'OAuth Client ID', required: false, secret: false },
      { key: 'JIRA_CLIENT_SECRET', label: 'OAuth Client Secret', required: false, secret: true },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Search pages, databases, blocks',
    category: 'productivity',
    icon: 'notion',
    entrypoint: 'domains/cowork/connectors/notion/dist/index.js',
    envVars: [{ key: 'NOTION_API_KEY', label: 'Integration Token', required: true, secret: true }],
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Sheets, Docs, Chat, Drive — OAuth token refresh',
    category: 'productivity',
    icon: 'google',
    entrypoint: 'domains/cowork/connectors/google-workspace/dist/index.js',
    envVars: [
      { key: 'GOOGLE_ACCESS_TOKEN', label: 'Access Token', required: true, secret: true },
      { key: 'GOOGLE_REFRESH_TOKEN', label: 'Refresh Token', required: true, secret: true },
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', required: true, secret: false },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', required: true, secret: true },
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM objects, search, create/update contacts and deals',
    category: 'crm',
    icon: 'hubspot',
    entrypoint: 'domains/cowork/connectors/hubspot/dist/index.js',
    envVars: [
      { key: 'HUBSPOT_ACCESS_TOKEN', label: 'Access Token', required: false, secret: true },
      { key: 'HUBSPOT_CLIENT_ID', label: 'OAuth Client ID', required: false, secret: false },
      { key: 'HUBSPOT_CLIENT_SECRET', label: 'OAuth Client Secret', required: false, secret: true },
      { key: 'HUBSPOT_REFRESH_TOKEN', label: 'OAuth Refresh Token', required: false, secret: true },
    ],
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Files, nodes, components, styles',
    category: 'devtools',
    icon: 'figma',
    entrypoint: 'domains/cowork/connectors/figma/dist/index.js',
    envVars: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Personal Access Token', required: true, secret: true }],
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Projects, tasks CRUD, subtasks',
    category: 'productivity',
    icon: 'asana',
    entrypoint: 'domains/cowork/connectors/asana/dist/index.js',
    envVars: [
      { key: 'ASANA_ACCESS_TOKEN', label: 'Personal Access Token', required: true, secret: true },
      { key: 'ASANA_BASE_URL', label: 'Base URL', required: false, secret: false },
    ],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Objects, SOQL queries, records CRUD',
    category: 'crm',
    icon: 'salesforce',
    entrypoint: 'domains/cowork/connectors/salesforce/dist/index.js',
    envVars: [
      { key: 'SALESFORCE_INSTANCE_URL', label: 'Instance URL', required: true, secret: false },
      { key: 'SALESFORCE_ACCESS_TOKEN', label: 'Access Token', required: false, secret: true },
      { key: 'SALESFORCE_REFRESH_TOKEN', label: 'Refresh Token', required: false, secret: true },
      { key: 'SALESFORCE_CLIENT_ID', label: 'Client ID', required: false, secret: false },
      { key: 'SALESFORCE_CLIENT_SECRET', label: 'Client Secret', required: false, secret: true },
    ],
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Tickets CRUD, search, comment threads',
    category: 'crm',
    icon: 'zendesk',
    entrypoint: 'domains/cowork/connectors/zendesk/dist/index.js',
    envVars: [
      { key: 'ZENDESK_SUBDOMAIN', label: 'Subdomain', required: true, secret: false },
      { key: 'ZENDESK_EMAIL', label: 'Email', required: false, secret: false },
      { key: 'ZENDESK_API_TOKEN', label: 'API Token', required: false, secret: true },
      { key: 'ZENDESK_ACCESS_TOKEN', label: 'OAuth Access Token', required: false, secret: true },
      { key: 'ZENDESK_REFRESH_TOKEN', label: 'OAuth Refresh Token', required: false, secret: true },
      { key: 'ZENDESK_CLIENT_ID', label: 'OAuth Client ID', required: false, secret: false },
      { key: 'ZENDESK_CLIENT_SECRET', label: 'OAuth Client Secret', required: false, secret: true },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Projects, deployments, environment variables',
    category: 'infra',
    icon: 'vercel',
    entrypoint: 'domains/cowork/connectors/vercel/dist/index.js',
    envVars: [{ key: 'VERCEL_TOKEN', label: 'API Token', required: true, secret: true }],
  },
  {
    id: 'okta',
    name: 'Okta',
    description: 'Users CRUD, groups, applications',
    category: 'infra',
    icon: 'okta',
    entrypoint: 'domains/cowork/connectors/okta/dist/index.js',
    envVars: [
      { key: 'OKTA_BASE_URL', label: 'Org URL', required: true, secret: false },
      { key: 'OKTA_API_TOKEN', label: 'API Token', required: true, secret: true },
    ],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    description: 'Boards, items, columns, updates',
    category: 'productivity',
    icon: 'monday',
    entrypoint: 'domains/cowork/connectors/monday/dist/index.js',
    envVars: [{ key: 'MONDAY_API_TOKEN', label: 'API Token', required: true, secret: true }],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Guilds, channels, messages, roles, webhooks',
    category: 'comms',
    icon: 'discord',
    entrypoint: 'domains/cowork/connectors/discord/dist/index.js',
    envVars: [
      { key: 'DISCORD_BOT_TOKEN', label: 'Bot Token', required: true, secret: true },
      { key: 'DISCORD_APPLICATION_ID', label: 'Application ID', required: true, secret: false },
      { key: 'DISCORD_GUILD_ID', label: 'Guild ID (default)', required: false, secret: false },
    ],
  },
];

export function getConnectorById(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_MANIFEST.find((c) => c.id === id);
}

export type ConnectorCategory = ConnectorDefinition['category'];
