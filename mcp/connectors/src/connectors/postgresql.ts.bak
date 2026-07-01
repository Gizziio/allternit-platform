import { BaseConnector, ConnectorCapabilities } from '../connector.js';

export class PostgreSQLConnector extends BaseConnector {
  readonly id = 'postgresql';
  readonly name = 'PostgreSQL';
  readonly version = '1.0.0';
  readonly description = 'PostgreSQL database connector';
  
  readonly configSchema = {
    host: { type: 'string' as const, required: true, default: 'localhost' },
    port: { type: 'number' as const, required: true, default: 5432 },
    database: { type: 'string' as const, required: true },
    user: { type: 'string' as const, required: true },
    password: { type: 'string' as const, required: true, secret: true },
    ssl: { type: 'boolean' as const, required: false, default: false }
  };
  
  private client: any = null;
  
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('PostgreSQL connector not configured');
    }
    
    try {
      const { Client } = await import('pg');
      this.client = new Client({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false
      });
      
      await this.client.connect();
      this.connected = true;
      console.log('PostgreSQL connector connected');
    } catch (error) {
      console.error('Failed to connect PostgreSQL:', error);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.connected = false;
      console.log('PostgreSQL connector disconnected');
    }
  }
  
  getCapabilities(): ConnectorCapabilities {
    return {
      operations: [
        'query',
        'execute',
        'listTables',
        'describeTable',
        'insert',
        'update',
        'delete'
      ],
      resources: ['tables', 'views', 'schemas'],
      events: []
    };
  }
  
  async execute(operation: string, params: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error('PostgreSQL connector not connected');
    }
    
    switch (operation) {
      case 'query':
        return await this.client.query(params.sql, params.params);
      
      case 'listTables':
        return await this.client.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
          [params.schema || 'public']
        );
      
      case 'describeTable':
        return await this.client.query(
          'SELECT * FROM information_schema.columns WHERE table_name = $1',
          [params.table]
        );
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

export default PostgreSQLConnector;
