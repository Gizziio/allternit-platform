/**
 * MCP Connectors
 * 
 * External service integrations for Allternit agents
 */

import { BaseConnector } from './connector.js';
import { ConnectorRegistry } from './registry.js';

export { BaseConnector } from './connector.js';
export type { Connector, ConnectorConfig, ConfigSchema, ConnectorCapabilities } from './connector.js';
export { ConnectorRegistry } from './registry.js';

export default { BaseConnector, ConnectorRegistry };
