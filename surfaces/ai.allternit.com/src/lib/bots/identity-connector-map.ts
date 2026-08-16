import type {
  AgentEmailChannel,
  AgentPhoneChannel,
  AgentWalletChannel,
} from '@/lib/agents/agent.types';
import type { OwnedConnector } from '@/lib/design/owned-connector';

export type IdentityKind = 'email' | 'phone' | 'wallet';

export interface IdentityConnectorMapping {
  kind: IdentityKind;
  provider: AgentEmailChannel['provider'] | AgentPhoneChannel['provider'] | AgentWalletChannel['provider'];
  label: string;
}

const IDENTITY_CONNECTOR_MAP: Record<string, IdentityConnectorMapping> = {
  gmail: { kind: 'email', provider: 'google_workspace', label: 'Gmail' },
  outlook: { kind: 'email', provider: 'microsoft_365', label: 'Outlook' },
  'agent-mail': { kind: 'email', provider: 'agent_mail', label: 'AgentMail' },
  'generic-email': { kind: 'email', provider: 'generic_imap', label: 'Generic Email' },
  twilio: { kind: 'phone', provider: 'twilio', label: 'Twilio' },
  telnyx: { kind: 'phone', provider: 'telnyx', label: 'Telnyx' },
  'android-bridge': { kind: 'phone', provider: 'android_bridge', label: 'Android Bridge' },
  photon: { kind: 'phone', provider: 'photon', label: 'Photon.codes' },
};

export function getIdentityMappingForConnector(
  connectorId: string,
): IdentityConnectorMapping | undefined {
  return IDENTITY_CONNECTOR_MAP[connectorId];
}

export function isIdentityConnector(connectorId: string): boolean {
  return connectorId in IDENTITY_CONNECTOR_MAP;
}

export function getConnectorAccountIdentifier(connector: OwnedConnector): string | undefined {
  return connector.connection?.account || connector.availability?.account;
}

export function listIdentityConnectors(
  connectors: OwnedConnector[],
  kind: IdentityKind,
): OwnedConnector[] {
  return connectors.filter((c) => getIdentityMappingForConnector(c.id)?.kind === kind);
}
