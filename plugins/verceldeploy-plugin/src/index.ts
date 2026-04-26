import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import * as child_process from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import manifest from '../manifest.json';

export { manifest };

const execAsync = util.promisify(child_process.exec);

export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  try {
    const token = host.config?.get?.('VERCEL_TOKEN') ?? process.env.VERCEL_TOKEN;

    if (!token || typeof token !== 'string') {
      return {
        success: false,
        error: {
          message: 'VERCEL_TOKEN not configured',
          code: 'MISSING_TOKEN',
          retryable: false
        }
      };
    }

    const projectPath = params?.path;
    if (!projectPath || typeof projectPath !== 'string') {
      return {
        success: false,
        error: {
          message: 'Missing required parameter: path',
          code: 'INVALID_PARAMS',
          retryable: false
        }
      };
    }

    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: {
          message: `Project path does not exist: ${resolvedPath}`,
          code: 'PATH_NOT_FOUND',
          retryable: false
        }
      };
    }

    const isProd = params?.prod === true;
    const projectName = params?.projectName;

    // Check if vercel CLI is available
    let vercelAvailable = false;
    try {
      await execAsync('which vercel');
      vercelAvailable = true;
    } catch {
      vercelAvailable = false;
    }

    if (vercelAvailable) {
      const args = ['--yes', '--cwd', resolvedPath];
      if (isProd) {
        args.push('--prod');
      }
      if (projectName) {
        args.push('--name', projectName);
      }

      host.logger.info(`Running: vercel ${args.join(' ')}`);

      const { stdout, stderr } = await execAsync(
        `vercel ${args.join(' ')}`,
        {
          env: {
            ...process.env,
            VERCEL_TOKEN: token
          },
          timeout: 300000
        }
      );

      const output = stdout || stderr || '';
      const urlMatch = output.match(/https:\/\/[a-zA-Z0-9\-._/]+\.vercel\.app/);
      const deploymentUrl = urlMatch ? urlMatch[0] : 'https://vercel.com/dashboard';

      return {
        success: true,
        content: `Deployment initiated. URL: ${deploymentUrl}`,
        data: {
          url: deploymentUrl,
          state: 'BUILDING',
          output
        }
      };
    }

    // Fallback: return instructions + API preview URL
    const previewUrl = projectName
      ? `https://${projectName}.vercel.app`
      : 'https://vercel.com/dashboard';

    const instructions = [
      'Vercel CLI is not installed locally.',
      '',
      'To deploy manually, run:',
      `  cd ${resolvedPath}`,
      `  npx vercel@latest --yes${isProd ? ' --prod' : ''}`,
      '',
      'Or install the CLI globally:',
      '  npm i -g vercel',
      '',
      `Expected deployment URL: ${previewUrl}`
    ].join('\n');

    return {
      success: true,
      content: instructions,
      data: {
        url: previewUrl,
        state: 'PENDING_CLI',
        instructions
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    host.logger.error('Vercel deploy failed:', errorMsg);

    return {
      success: false,
      error: {
        message: errorMsg,
        code: 'DEPLOYMENT_FAILED',
        retryable: true
      }
    };
  }
}
