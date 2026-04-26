/**
 * OAuth Integration Test
 * 
 * Verifies the platform-side OAuth logic:
 * 1. Create an auth code with PKCE challenge
 * 2. Consume the code and issue a token pair
 * 3. Verify PKCE S256 verification logic
 * 4. Validate the issued access token
 * 5. Rotate the refresh token
 * 
 * Run with: pnpm tsx scripts/test-oauth-integration.ts
 */

import { createAuthCode } from '../src/lib/oauth-codes';
import { issueTokenPair, validateAccessToken, rotateRefreshToken } from '../src/lib/oauth-tokens';
import { createHash } from 'node:crypto';

async function test() {
  console.log('🚀 Starting OAuth Integration Test...');

  // 1. Setup PKCE
  const verifier = 'test-verifier-that-is-at-least-43-characters-long-1234567890';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  
  console.log('PKCE Verifier:', verifier);
  console.log('PKCE Challenge:', challenge);

  // 2. Create Auth Code
  console.log('\nStep 1: Creating Auth Code...');
  const clientId = 'allternit-desktop';
  const redirectUri = 'allternit://auth/callback';
  const userId = 'user_test_123';
  const userEmail = 'test@allternit.com';

  const code = await createAuthCode({
    clientId,
    redirectUri,
    userId,
    userEmail,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    scope: 'profile email',
  });

  console.log('Auth Code Issued:', code);

  // 3. Exchange Code for Tokens (Manual Simulation of /api/oauth/token logic)
  console.log('\nStep 2: Exchanging Code for Tokens...');
  
  // Note: In the real API route, we'd call consumeAuthCode and verifyPKCE.
  // Here we'll simulate the logic flow to verify the library functions work together.
  
  const { consumeAuthCode } = await import('../src/lib/oauth-codes');
  const stored = await consumeAuthCode(code);
  
  if (!stored) {
    throw new Error('FAILED: Code could not be consumed');
  }
  console.log('Code consumed successfully.');

  // Verify PKCE (Logic copied from /api/oauth/token/route.ts)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  if (b64 !== stored.codeChallenge) {
    throw new Error('FAILED: PKCE verification failed');
  }
  console.log('PKCE verified successfully.');

  const pair = await issueTokenPair({
    userId: stored.userId,
    userEmail: stored.userEmail,
    clientId: stored.clientId,
    scope: stored.scope,
  });

  console.log('Token Pair Issued:');
  console.log('  Access Token:', pair.access_token.substring(0, 20) + '...');
  console.log('  Refresh Token:', pair.refresh_token.substring(0, 10) + '...');

  // 4. Validate Access Token
  console.log('\nStep 3: Validating Access Token...');
  const payload = await validateAccessToken(pair.access_token);
  if (!payload || payload.userId !== userId) {
    throw new Error('FAILED: Access token validation failed');
  }
  console.log('Access token is valid. Claims match.');

  // 5. Rotate Refresh Token
  console.log('\nStep 4: Rotating Refresh Token...');
  const newPair = await rotateRefreshToken(pair.refresh_token);
  if (!newPair) {
    throw new Error('FAILED: Refresh token rotation failed');
  }
  console.log('Refresh token rotated successfully.');
  console.log('  New Access Token:', newPair.access_token.substring(0, 20) + '...');

  // 6. Verify Old Refresh Token is invalid
  console.log('\nStep 5: Verifying single-use refresh token...');
  const failedPair = await rotateRefreshToken(pair.refresh_token);
  if (failedPair) {
    throw new Error('FAILED: Old refresh token was not invalidated');
  }
  console.log('Old refresh token is correctly invalidated.');

  console.log('\n✅ ALL OAUTH FLOW TESTS PASSED');
}

test().catch(err => {
  console.error('\n❌ TEST FAILED:');
  console.error(err);
  process.exit(1);
});
