/**
 * @fileoverview Authentication commands for gizzi CLI
 * @module cli/commands/auth
 *
 * Provides CLI commands for managing authentication across three modes:
 * - BYOK (Bring Your Own Key): User manages their own API keys
 * - Cloud: OAuth-based authentication with Allternit Cloud
 * - Local: Local Ollama server integration
 *
 * @example
 * ```bash
 * # BYOK mode - Add API key
 * gizzi auth add anthropic --key sk-ant-...
 *
 * # Cloud mode - Login
 * gizzi auth login
 *
 * # Local mode - Connect to Ollama
 * gizzi provider add ollama --url http://localhost:11434
 *
 * # Check status
 * gizzi auth status
 *
 * # Logout
 * gizzi auth logout
 * ```
 */

import { createInterface } from 'readline';
import { randomBytes, createHash } from 'crypto';
import { createServer } from 'http';
import { open } from '../utils/open.js';
import Config from '../config.js';

/**
 * Supported AI providers for BYOK mode
 * @constant {readonly string[]}
 */
const SUPPORTED_PROVIDERS = ['anthropic', 'openai', 'google', 'cohere', 'mistral'] as const;

type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

/**
 * Checks if a string is a supported provider
 * @param {string} provider - The provider name to check
 * @returns {boolean} True if the provider is supported
 */
function isSupportedProvider(provider: string): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);
}

/**
 * Prompts the user for a secret input (password/API key)
 * Masks the input with asterisks
 * @param {string} message - The prompt message
 * @returns {Promise<string>} The user input
 */
async function promptSecret(message: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // @ts-expect-error - readline types don't expose _writeToOutput
    rl._writeToOutput = (string: string) => {
      if (string.trim() === message.trim()) {
        process.stdout.write(message);
      } else {
        process.stdout.write('*');
      }
    };

    rl.question(message, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/**
 * Prompts for regular text input
 * @param {string} message - The prompt message
 * @returns {Promise<string>} The user input
 */
async function prompt(message: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Creates an OAuth PKCE challenge
 * Generates code verifier and challenge for secure OAuth flow
 * @returns {Promise<{codeVerifier: string, codeChallenge: string}>} PKCE parameters
 */
async function createOAuthChallenge(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // Generate code verifier (43-128 characters)
  const codeVerifier = randomBytes(32).toString('base64url');

  // Create code challenge (SHA256 hash of verifier)
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Starts a local callback server for OAuth callback
 * Listens on a local port to receive the authorization code
 * @param {number} [port=8765] - The port to listen on
 * @returns {Promise<{code: string, state?: string}>} The authorization code and state
 */
async function startCallbackServer(port = 8765): Promise<{ code: string; state?: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? undefined;
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: "Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #e74c3c;">Authentication Failed</h1>
              <p>${error}</p>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: "Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #2ecc71;">✓ Authentication Successful</h1>
              <p>You can close this window and return to the terminal.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
        server.close();
        resolve({ code, state });
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: "Allternit Sans", Inter, ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #e74c3c;">Authentication Failed</h1>
              <p>No authorization code received.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error('No authorization code received'));
      }
    });

    server.listen(port, () => {
      console.log(`Waiting for authentication callback on port ${port}...`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout - please try again'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Exchanges OAuth authorization code for access tokens
 * @param {string} code - The authorization code
 * @param {string} codeVerifier - The PKCE code verifier
 * @returns {Promise<{accessToken: string, refreshToken: string}>} The tokens
 */
async function exchangeCode(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // TODO: Replace with actual Allternit Cloud OAuth token endpoint
  const tokenEndpoint = process.env.ALLTERNIT_TOKEN_URL ?? 'https://api.allternit.com/oauth/token';

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: 'gizzi-cli',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * Command: gizzi auth add <provider>
 * Adds an API key for BYOK mode
 * @param {string} provider - The provider name (anthropic, openai, google, etc.)
 * @param {Object} options - Command options
 * @param {string} [options.key] - The API key (prompted if not provided)
 */
export async function authAdd(
  provider: string,
  options: { key?: string }
): Promise<void> {
  // Validate provider
  if (!isSupportedProvider(provider)) {
    console.error(`✗ Unsupported provider: ${provider}`);
    console.error(`  Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
    process.exit(1);
  }

  // Get API key (from options or prompt)
  const key = options.key ?? await promptSecret(`Enter ${provider} API key: `);

  if (!key || key.trim() === '') {
    console.error('✗ API key is required');
    process.exit(1);
  }

  try {
    // Store in config
    await Config.set(`providers.byok.${provider}.apiKey`, key.trim());
    await Config.set('mode', 'byok');

    console.log(`✓ ${provider} API key saved`);
    console.log(`  Mode set to: BYOK (Bring Your Own Key)`);

    // Optional: Validate key with a test request
    // This could be implemented per-provider
  } catch (error) {
    console.error(`✗ Failed to save API key: ${error}`);
    process.exit(1);
  }
}

/**
 * Command: gizzi auth login
 * Logs in to Allternit Cloud (Cloud mode)
 */
export async function authLogin(): Promise<void> {
  try {
    // Create OAuth challenge
    const { codeVerifier, codeChallenge } = await createOAuthChallenge();

    // Build authorization URL
    // TODO: Replace with actual Allternit Cloud OAuth authorization endpoint
    const authBaseUrl = process.env.ALLTERNIT_AUTH_URL ?? 'https://api.allternit.com/oauth/authorize';
    const redirectUri = 'http://localhost:8765/callback';
    const state = randomBytes(16).toString('hex');

    const authUrl = new URL(authBaseUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'gizzi-cli');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'read write');

    console.log('Starting Allternit Cloud login...');
    console.log(`Opening browser: ${authUrl.toString()}`);

    // Open browser
    await open(authUrl.toString());

    // Start local callback server
    console.log('Waiting for authentication...');
    const { code, state: returnedState } = await startCallbackServer();

    // Verify state to prevent CSRF
    if (returnedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Exchange code for tokens
    console.log('Exchanging authorization code for tokens...');
    const { accessToken, refreshToken } = await exchangeCode(code, codeVerifier);

    // Store tokens
    await Config.set('mode', 'cloud');
    await Config.set('cloud.accessToken', accessToken);
    await Config.set('cloud.refreshToken', refreshToken);

    console.log('✓ Logged in to Allternit Cloud');
    console.log('  Mode set to: Cloud');
  } catch (error) {
    console.error(`✗ Login failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Command: gizzi auth logout
 * Logs out and clears all credentials
 */
export async function authLogout(): Promise<void> {
  try {
    const mode = await Config.getMode();

    if (mode === 'cloud') {
      // TODO: Optionally revoke tokens on the server side
      await Config.delete('cloud.accessToken');
      await Config.delete('cloud.refreshToken');
      await Config.delete('cloud.expiresAt');
      await Config.delete('cloud.userId');
    }

    // Clear mode
    await Config.delete('mode');

    console.log('✓ Logged out');

    if (mode) {
      console.log(`  Previous mode (${mode}) credentials cleared`);
    }
  } catch (error) {
    console.error(`✗ Logout failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Command: gizzi auth status
 * Shows current authentication status
 */
export async function authStatus(): Promise<void> {
  try {
    const config = await Config.getConfig();
    const mode = config.mode;

    console.log('Authentication Status');
    console.log('====================');
    console.log(`Mode: ${mode ?? 'not configured'}`);

    if (mode === 'byok') {
      console.log('\nProvider Keys:');
      for (const provider of SUPPORTED_PROVIDERS) {
        const key = config.providers.byok[provider]?.apiKey;
        console.log(`  ${provider}: ${key ? '✓ configured' : '✗ not set'}`);
      }
    } else if (mode === 'cloud') {
      const token = config.cloud.accessToken;
      console.log(`  Cloud: ${token ? '✓ logged in' : '✗ not logged in'}`);
      if (config.cloud.userId) {
        console.log(`  User ID: ${config.cloud.userId}`);
      }
      if (config.cloud.expiresAt) {
        const expiresAt = new Date(config.cloud.expiresAt);
        const isExpired = expiresAt < new Date();
        console.log(`  Token expires: ${expiresAt.toLocaleString()} ${isExpired ? '(expired)' : ''}`);
      }
    } else if (mode === 'local') {
      console.log(`  Ollama URL: ${config.local.baseURL}`);
      if (config.local.defaultModel) {
        console.log(`  Default model: ${config.local.defaultModel}`);
      }
    } else {
      console.log('\nTo configure authentication, run:');
      console.log('  gizzi auth add <provider>    # BYOK mode');
      console.log('  gizzi auth login             # Cloud mode');
      console.log('  gizzi provider add ollama    # Local mode');
    }
  } catch (error) {
    console.error(`✗ Failed to get status: ${error}`);
    process.exit(1);
  }
}

/**
 * Command: gizzi provider add ollama
 * Configures local Ollama server (Local mode)
 * @param {Object} options - Command options
 * @param {string} [options.url] - The Ollama server URL
 */
export async function providerAddOllama(
  options: { url?: string }
): Promise<void> {
  const url = options.url ?? 'http://localhost:11434';

  try {
    // Validate URL format
    new URL(url);

    // Store configuration
    await Config.set('local.baseURL', url);
    await Config.set('mode', 'local');

    console.log(`✓ Ollama configured at ${url}`);
    console.log('  Mode set to: Local');

    // Optionally test connection
    try {
      const response = await fetch(`${url}/api/tags`, { method: 'GET' });
      if (response.ok) {
        console.log('  ✓ Connection test successful');
      } else {
        console.log('  ⚠ Connection test failed - server may not be running');
      }
    } catch {
      console.log('  ⚠ Could not connect to Ollama server - it may not be running');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      console.error(`✗ Invalid URL: ${url}`);
    } else {
      console.error(`✗ Failed to configure Ollama: ${error}`);
    }
    process.exit(1);
  }
}

/** CLI command definition type */
export interface AuthCommand {
  name: string;
  description: string;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: string;
  }>;
  action: (...args: unknown[]) => Promise<void> | void;
}

/** Provider command definition type */
export interface ProviderCommand {
  name: string;
  description: string;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: string;
  }>;
  action: (...args: unknown[]) => Promise<void> | void;
}

// Command definitions for CLI framework integration (e.g., commander.js)
export const authCommands: AuthCommand[] = [
  {
    name: 'auth add <provider>',
    description: 'Add API key for a provider (BYOK mode)',
    options: [
      {
        flags: '-k, --key <key>',
        description: 'API key (or prompt if not provided)',
      },
    ],
    action: authAdd,
  },
  {
    name: 'auth login',
    description: 'Login to Allternit (Cloud mode)',
    action: authLogin,
  },
  {
    name: 'auth logout',
    description: 'Logout and clear credentials',
    action: authLogout,
  },
  {
    name: 'auth status',
    description: 'Show current authentication status',
    action: authStatus,
  },
];

export const providerCommands: ProviderCommand[] = [
  {
    name: 'provider add ollama',
    description: 'Connect to local Ollama server (Local mode)',
    options: [
      {
        flags: '-u, --url <url>',
        description: 'Ollama server URL',
        defaultValue: 'http://localhost:11434',
      },
    ],
    action: providerAddOllama,
  },
];

// Default export
export default {
  authAdd,
  authLogin,
  authLogout,
  authStatus,
  providerAddOllama,
  authCommands,
  providerCommands,
};
