import { Connector } from './connector.js';

export class ConnectorRegistry {
  private connectors: Map<string, Connector> = new Map();
  
  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
    console.log(`Registered connector: ${connector.id}`);
  }
  
  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }
  
  list(): Connector[] {
    return Array.from(this.connectors.values());
  }
  
  async connectAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      try {
        await connector.connect();
        console.log(`Connected: ${connector.id}`);
      } catch (error) {
        console.error(`Failed to connect ${connector.id}:`, error);
      }
    }
  }
  
  async disconnectAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.disconnect();
    }
  }
}

export default ConnectorRegistry;
