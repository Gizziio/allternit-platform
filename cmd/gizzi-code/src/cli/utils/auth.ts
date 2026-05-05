/**
 * Authentication Utilities
 * Production-quality OAuth and API key authentication
 */

import { createServer, type Server } from 'http'
import { URL } from 'url'
import { randomBytes, createHash } from 'crypto'
import open from 'open'
import { log } from './log.js'
import { 
  saveSession, 
  loadSession, 
  clearSession,
  type SessionData,
  type UserType 
} from '../../utils/sessionStorage.js'

// OAuth Configuration
const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID || 'gizzi-cli',
  authorizationEndpoint: process.env.OAUTH_AUTH_URL || 'https://auth.gizzi.ai/authorize',
  tokenEndpoint: process.env.OAUTH_TOKEN_URL || 'https://auth.gizzi.ai/token',
  redirectUri: 'http://localhost:0/callback',
  scopes: ['read', 'write', 'profile'],
}

export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  type: 'bearer'
}

export interface UserInfo {
  id: string
  email: string
  name?: string
  avatar?: string
  type: UserType
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Generate random state parameter
 */
function generateState(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Start local OAuth callback server
 */
function startCallbackServer(state: string, codeVerifier: string): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '', `http://localhost`)
        
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }
        
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        
        if (error) {
          res.writeHead(400)
          res.end(`Authentication error: ${error}`)
          reject(new Error(`OAuth error: ${error}`))
          server.close()
          return
        }
        
        if (!code) {
          res.writeHead(400)
          res.end('Missing authorization code')
          reject(new Error('Missing authorization code'))
          server.close()
          return
        }
        
        if (returnedState !== state) {
          res.writeHead(400)
          res.end('Invalid state parameter')
          reject(new Error('Invalid state parameter'))
          server.close()
          return
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body style="font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 50px;">
              <h1>✓ Authentication Successful</h1>
              <p>You can close this window and return to the CLI.</p>
            </body>
          </html>
        `)
        
        resolve({ code, state: returnedState })
        server.close()
      } catch (err) {
        reject(err)
        server.close()
      }
    })
    
    server.listen(0, 'localhost', () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        OAUTH_CONFIG.redirectUri = `http://localhost:${address.port}/callback`
      }
    })
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth timeout'))
    }, 5 * 60 * 1000)
  })
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<AuthToken> {
  const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CONFIG.clientId,
      code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    type: 'bearer',
  }
}

/**
 * Fetch user info from API
 */
async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch('https://api.gizzi.ai/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }
  
  return response.json()
}

/**
 * Login with OAuth
 */
export async function login(): Promise<void> {
  log('info', 'Starting OAuth login flow...')
  
  try {
    const { verifier, challenge } = generatePKCE()
    const state = generateState()
    
    // Start callback server
    const callbackPromise = startCallbackServer(state, verifier)
    
    // Build authorization URL
    const authUrl = new URL(OAUTH_CONFIG.authorizationEndpoint)
    authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri)
    authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.join(' '))
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    
    // Open browser
    log('info', 'Opening browser for authentication...')
    await open(authUrl.toString())
    
    // Wait for callback
    const { code } = await callbackPromise
    
    // Exchange code for tokens
    log('info', 'Exchanging code for tokens...')
    const tokens = await exchangeCodeForTokens(code, verifier)
    
    // Fetch user info
    log('info', 'Fetching user info...')
    const userInfo = await fetchUserInfo(tokens.accessToken)
    
    // Save session
    const session: SessionData = {
      sessionId: `sess_${Date.now()}`,
      userId: userInfo.id,
      userType: userInfo.type || 'authenticated',
      email: userInfo.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: tokens.expiresAt,
    }
    
    await saveSession(session)
    
    log('info', `Successfully logged in as ${userInfo.email}`)
  } catch (error) {
    log('error', 'Login failed', error)
    throw error
  }
}

/**
 * Login with API key
 */
export async function loginWithApiKey(apiKey: string): Promise<void> {
  log('info', 'Authenticating with API key...')
  
  try {
    // Validate API key
    const response = await fetch('https://api.gizzi.ai/auth/validate', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('Invalid API key')
    }
    
    const userInfo = await response.json()
    
    const session: SessionData = {
      sessionId: `sess_${Date.now()}`,
      userId: userInfo.id,
      userType: userInfo.type || 'authenticated',
      email: userInfo.email,
      accessToken: apiKey,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    }
    
    await saveSession(session)
    
    log('info', `Successfully authenticated as ${userInfo.email}`)
  } catch (error) {
    log('error', 'API key authentication failed', error)
    throw error
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  const session = await loadSession()
  
  if (session?.accessToken) {
    // Revoke token on server
    try {
      await fetch('https://api.gizzi.ai/auth/revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })
    } catch {
      // Ignore revocation errors
    }
  }
  
  await clearSession()
  log('info', 'Logged out successfully')
}

/**
 * Refresh access token
 */
export async function refreshToken(): Promise<string> {
  const session = await loadSession()
  
  if (!session?.refreshToken) {
    throw new Error('No refresh token available')
  }
  
  try {
    const response = await fetch(OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OAUTH_CONFIG.clientId,
        refresh_token: session.refreshToken,
      }),
    })
    
    if (!response.ok) {
      throw new Error('Token refresh failed')
    }
    
    const data = await response.json()
    
    // Update session
    session.accessToken = data.access_token
    session.expiresAt = Date.now() + (data.expires_in * 1000)
    if (data.refresh_token) {
      session.refreshToken = data.refresh_token
    }
    
    await saveSession(session)
    
    return session.accessToken
  } catch (error) {
    log('error', 'Token refresh failed', error)
    throw error
  }
}

/**
 * Get current token (refreshing if necessary)
 */
export async function getCurrentToken(): Promise<string | null> {
  const session = await loadSession()
  
  if (!session?.accessToken) {
    return null
  }
  
  // Check if token is expired or expiring soon (5 minutes)
  if (session.expiresAt && session.expiresAt < Date.now() + 5 * 60 * 1000) {
    if (session.refreshToken) {
      return refreshToken()
    }
    return null
  }
  
  return session.accessToken
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  const session = await loadSession()
  
  if (!session?.userId) {
    return null
  }
  
  return {
    id: session.userId,
    email: session.email || '',
    type: session.userType,
  }
}

/**
 * Check if authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getCurrentToken()
  return token !== null
}

/**
 * Require authentication
 */
export async function requireAuth(): Promise<string> {
  const token = await getCurrentToken()
  
  if (!token) {
    throw new Error('Authentication required. Please run `gizzi login`.')
  }
  
  return token
}

/**
 * Get auth headers for API requests
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await requireAuth()
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Check if using 3P services (placeholder for future)
 */
export function isUsing3PServices(): boolean {
  return process.env.ENABLE_3P_SERVICES === 'true'
}

/**
 * Check if Claude AI subscriber
 */
export async function isClaudeAISubscriber(): Promise<boolean> {
  const session = await loadSession()
  return session?.userType === 'ant' || session?.userType === 'admin'
}

// Default export
export default {
  login,
  loginWithApiKey,
  logout,
  refreshToken,
  getCurrentToken,
  getCurrentUser,
  isAuthenticated,
  requireAuth,
  getAuthHeaders,
  isUsing3PServices,
  isClaudeAISubscriber,
}
