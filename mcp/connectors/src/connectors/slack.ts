import { BaseConnector, ConnectorCapabilities } from '../connector.js';

export class SlackConnector extends BaseConnector {
  readonly id = 'slack';
  readonly name = 'Slack';
  readonly version = '1.0.0';
  readonly description = 'Slack API integration';
  
  readonly configSchema = {
    token: { type: 'string', required: true, secret: true },
    signingSecret: { type: 'string', required: false, secret: true }
  };
  
  private client: any = null;
  
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Slack connector not configured');
    }
    
    try {
      const { WebClient } = await import('@slack/web-api');
      this.client = new WebClient(this.config.token);
      this.connected = true;
      console.log('Slack connector connected');
    } catch (error) {
      console.error('Failed to connect Slack:', error);
      throw error;
    }
  }
  
  getCapabilities(): ConnectorCapabilities {
    return {
      operations: [
        'sendMessage',
        'listChannels',
        'getChannel',
        'listUsers',
        'getUser',
        'uploadFile'
      ],
      resources: ['channels', 'users', 'files', 'messages'],
      events: ['message', 'reaction_added', 'file_shared']
    };
  }
  
  async execute(operation: string, params: Record<string, any>): Promise<any> {
    if (!this.client) {
      throw new Error('Slack connector not connected');
    }
    
    switch (operation) {
      case 'sendMessage':
        return await this.client.chat.postMessage(params);
      
      case 'listChannels':
        return await this.client.conversations.list(params);
      
      case 'listUsers':
        return await this.client.users.list(params);
      
      case 'uploadFile':
        return await this.client.files.upload(params);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

export default SlackConnector;
