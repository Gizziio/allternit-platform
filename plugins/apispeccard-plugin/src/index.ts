import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import manifest from '../manifest.json';

export { manifest };

export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  try {
    const result = await host.llm.complete(`
      Process using ApispeccardPlugin:
      Input: ${JSON.stringify(params)}
    `);
    
    host.ui.renderMarkdown(result);
    
    return { 
      success: true, 
      content: result 
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { 
      success: false, 
      error: { 
        message: errorMsg, 
        code: 'EXECUTION_FAILED',
        retryable: false 
      }
    };
  }
}
