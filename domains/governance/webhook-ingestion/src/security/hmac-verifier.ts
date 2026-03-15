/**
 * HMAC Signature Verifier
 * 
 * Verifies HMAC signatures on webhook payloads.
 * Supports SHA-256, SHA-1, and SHA-512.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signature verification result
 */
export interface VerificationResult {
  /** Whether signature is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Algorithm used */
  algorithm?: string;
}

/**
 * Verify HMAC signature
 * 
 * @param payload - Raw payload body (as string or Buffer)
 * @param signature - Signature from webhook header
 * @param secret - Secret key for HMAC
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @param encoding - Signature encoding ('hex' or 'base64')
 */
export function verifyHmacSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' | 'sha512' = 'sha256',
  encoding: 'hex' | 'base64' = 'hex'
): VerificationResult {
  try {
    // Convert payload to Buffer if string
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;
    
    // Parse signature format
    // GitHub format: sha256=abc123...
    // Generic format: just the signature
    let signatureValue = signature;
    let signatureAlgorithm = algorithm;
    
    if (signature.includes('=')) {
      const parts = signature.split('=');
      if (parts.length === 2) {
        signatureAlgorithm = parts[0] as 'sha256' | 'sha1' | 'sha512';
        signatureValue = parts[1];
      }
    }
    
    // Compute expected signature
    const expectedSignature = computeHmac(
      payloadBuffer,
      secret,
      signatureAlgorithm,
      encoding
    );
    
    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(signatureValue, encoding);
    const expectedBuffer = Buffer.from(expectedSignature, encoding);
    
    // Ensure both buffers are same length
    if (signatureBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: 'Signature length mismatch',
        algorithm: signatureAlgorithm,
      };
    }
    
    const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
    
    if (!isValid) {
      return {
        valid: false,
        error: 'Signature does not match',
        algorithm: signatureAlgorithm,
      };
    }
    
    return {
      valid: true,
      algorithm: signatureAlgorithm,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Verification failed: ${errorMessage}`,
    };
  }
}

/**
 * Compute HMAC signature
 */
function computeHmac(
  payload: Buffer,
  secret: string,
  algorithm: string,
  encoding: 'hex' | 'base64'
): string {
  const hmac = createHmac(algorithm, secret);
  hmac.update(payload);
  return hmac.digest(encoding);
}

/**
 * Extract signature from headers
 * 
 * Handles different header formats:
 * - GitHub: X-Hub-Signature-256: sha256=abc123...
 * - Generic: X-Signature: abc123...
 * - Custom: Any header name
 */
export function extractSignatureFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  headerNames: string[] = [
    'x-hub-signature-256',
    'x-hub-signature',
    'x-signature',
    'x-webhook-signature',
    'signature',
  ]
): { signature: string; algorithm?: string } | null {
  for (const headerName of headerNames) {
    const headerValue = headers[headerName.toLowerCase()];
    
    if (headerValue) {
      const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      
      // Extract algorithm if present (e.g., sha256=abc123)
      if (signature.includes('=')) {
        const parts = signature.split('=');
        if (parts.length === 2) {
          return {
            signature: parts[1],
            algorithm: parts[0],
          };
        }
      }
      
      return { signature };
    }
  }
  
  return null;
}

/**
 * Verify webhook signature with automatic header extraction
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): VerificationResult {
  const signatureData = extractSignatureFromHeaders(headers);
  
  if (!signatureData) {
    return {
      valid: false,
      error: 'No signature found in headers',
    };
  }
  
  const algorithm = signatureData.algorithm as 'sha256' | 'sha1' | 'sha512' || 'sha256';
  
  return verifyHmacSignature(rawBody, signatureData.signature, secret, algorithm);
}

/**
 * Source-specific signature verification configurations
 */
export interface SourceSignatureConfig {
  /** Header names to check (in order) */
  headerNames: string[];
  /** Default algorithm */
  defaultAlgorithm: 'sha256' | 'sha1' | 'sha512';
  /** Encoding */
  encoding: 'hex' | 'base64';
  /** Whether signature is required */
  required: boolean;
}

/**
 * Pre-configured signature settings for common sources
 */
export const SOURCE_SIGNATURE_CONFIGS: Record<string, SourceSignatureConfig> = {
  github: {
    headerNames: ['x-hub-signature-256', 'x-hub-signature'],
    defaultAlgorithm: 'sha256',
    encoding: 'hex',
    required: true,
  },
  discord: {
    headerNames: ['x-signature-ed25519'],
    defaultAlgorithm: 'sha256',
    encoding: 'hex',
    required: false, // Discord uses ed25519, not HMAC
  },
  slack: {
    headerNames: ['x-slack-signature'],
    defaultAlgorithm: 'sha256',
    encoding: 'hex',
    required: true,
  },
  gitlab: {
    headerNames: ['x-gitlab-token'],
    defaultAlgorithm: 'sha256',
    encoding: 'hex',
    required: false,
  },
};

/**
 * Verify signature based on source configuration
 */
export function verifySignatureForSource(
  source: string,
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): VerificationResult {
  const config = SOURCE_SIGNATURE_CONFIGS[source];
  
  if (!config) {
    // Fall back to generic verification
    return verifyWebhookSignature(rawBody, headers, secret);
  }
  
  const signatureData = extractSignatureFromHeaders(headers, config.headerNames);
  
  if (!signatureData) {
    if (config.required) {
      return {
        valid: false,
        error: `Required signature header not found. Expected one of: ${config.headerNames.join(', ')}`,
      };
    }
    
    // Signature not required, skip verification
    return {
      valid: true,
      error: undefined,
      algorithm: undefined,
    };
  }
  
  return verifyHmacSignature(
    rawBody,
    signatureData.signature,
    secret,
    config.defaultAlgorithm,
    config.encoding
  );
}
