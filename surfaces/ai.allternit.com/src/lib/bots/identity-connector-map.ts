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
  // Email: the open-connector catalog does not ship Gmail/Outlook/IMAP providers
  // in this workspace, so email identity is platform-managed (CommRails) or
  // configured through raw secrets. Do not map fake connector ids here.
  twilio: { kind: 'phone', provider: 'twilio', label: 'Twilio' },
  telnyx: { kind: 'phone', provider: 'telnyx', label: 'Telnyx' },
  vapi: { kind: 'phone', provider: 'vapi', label: 'Vapi' },
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
