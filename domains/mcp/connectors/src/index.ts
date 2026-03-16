/**
 * MCP Connectors
 * 
 * External service integrations for A2R agents
 */

export { BaseConnector } from './connector.js';
export type { Connector, ConnectorConfig, ConfigSchema, ConnectorCapabilities } from './connector.js';
export { ConnectorRegistry } from './registry.js';

export default { BaseConnector, ConnectorRegistry };
