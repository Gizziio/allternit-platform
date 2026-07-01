import { BaseConnector, ConnectorCapabilities } from '../connector.js';

export class GitHubConnector extends BaseConnector {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly version = '1.0.0';
  readonly description = 'GitHub API integration';
  
  readonly configSchema = {
    token: { type: 'string', required: true, secret: true },
    baseUrl: { type: 'string', required: false, default: 'https://api.github.com' }
  };
  
  private octokit: any = null;
  
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('GitHub connector not configured');
    }
    
    try {
      const { Octokit } = await import('@octokit/rest');
      this.octokit = new Octokit({
        auth: this.config.token,
        baseUrl: this.config.baseUrl
      });
      this.connected = true;
      console.log('GitHub connector connected');
    } catch (error) {
      console.error('Failed to connect GitHub:', error);
      throw error;
    }
  }
  
  getCapabilities(): ConnectorCapabilities {
    return {
      operations: [
        'listRepos',
        'createIssue',
        'listIssues',
        'createPR',
        'listPRs',
        'getRepo',
        'searchRepos'
      ],
      resources: ['repos', 'issues', 'pull_requests', 'users'],
      events: ['push', 'pull_request', 'issues']
    };
  }
  
  async execute(operation: string, params: Record<string, any>): Promise<any> {
    if (!this.octokit) {
      throw new Error('GitHub connector not connected');
    }
    
    switch (operation) {
      case 'listRepos':
        return await this.octokit.repos.listForAuthenticatedUser(params);
      
      case 'createIssue':
        return await this.octokit.issues.create(params);
      
      case 'listIssues':
        return await this.octokit.issues.listForRepo(params);
      
      case 'createPR':
        return await this.octokit.pulls.create(params);
      
      case 'getRepo':
        return await this.octokit.repos.get(params);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

export default GitHubConnector;
