/**
 * Data Minimizer
 * 
 * Prevents extraction of sensitive data like passwords, 2FA codes, credit cards.
 * Detects and blocks sensitive fields.
 */

export interface SensitiveField {
  type: 'password' | 'credit-card' | 'ssn' | '2fa' | 'api-key' | 'secret';
  selector: string;
  reason: string;
}

export interface MinimizerResult {
  allowed: boolean;
  sanitized?: string;
  reason?: string;
  detectedFields?: SensitiveField[];
}

// Patterns for detecting sensitive data
const SENSITIVE_PATTERNS = {
  password: {
    selectors: [
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
      'input[placeholder*="password" i]',
      '[data-testid*="password" i]',
    ],
    attributes: ['type="password"', 'autocomplete="current-password"', 'autocomplete="new-password"'],
    keywords: ['password', 'pass', 'pwd', 'senha', 'contraseña', 'mot de passe'],
  },
  'credit-card': {
    selectors: [
      'input[name*="card" i]',
      'input[id*="card" i]',
      'input[name*="cc" i]',
      'input[autocomplete="cc-number"]',
      'input[autocomplete="cc-csc"]',
    ],
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    keywords: ['card number', 'credit card', 'ccv', 'cvv', 'cvc', 'expiry'],
  },
  '2fa': {
    selectors: [
      'input[name*="otp" i]',
      'input[name*="2fa" i]',
      'input[name*="mfa" i]',
      'input[name*="totp" i]',
      'input[name*="code" i]',
      'input[autocomplete="one-time-code"]',
      '[data-testid*="otp" i]',
    ],
    keywords: ['verification code', 'auth code', '2fa code', 'otp', 'totp', 'security code'],
  },
  ssn: {
    regex: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/,
    keywords: ['social security', 'ssn', 'national insurance'],
  },
  'api-key': {
    selectors: [
      'input[name*="api" i]',
      'input[name*="key" i]',
      'input[name*="token" i]',
    ],
    regex: /\b(sk|pk)_(live|test|prod)_\w{24,}\b/,
    keywords: ['api key', 'secret key', 'auth token', 'bearer token'],
  },
};

/**
 * Check if HTML contains sensitive fields
 */
export function detectSensitiveFields(html: string): SensitiveField[] {
  const fields: SensitiveField[] = [];
  const lowerHtml = html.toLowerCase();

  // Check password fields
  if (SENSITIVE_PATTERNS.password.keywords.some(k => lowerHtml.includes(k))) {
    fields.push({
      type: 'password',
      selector: 'input[type="password"]',
      reason: 'Password input field detected',
    });
  }

  // Check credit card patterns
  if (SENSITIVE_PATTERNS['credit-card'].regex.test(html)) {
    fields.push({
      type: 'credit-card',
      selector: 'input[autocomplete="cc-number"]',
      reason: 'Credit card number pattern detected',
    });
  }

  // Check 2FA fields
  if (SENSITIVE_PATTERNS['2fa'].keywords.some(k => lowerHtml.includes(k))) {
    fields.push({
      type: '2fa',
      selector: 'input[autocomplete="one-time-code"]',
      reason: '2FA/OTP input field detected',
    });
  }

  // Check SSN patterns
  if (SENSITIVE_PATTERNS.ssn.regex.test(html)) {
    fields.push({
      type: 'ssn',
      selector: 'input[name*="ssn" i]',
      reason: 'SSN pattern detected',
    });
  }

  // Check API key patterns
  if (SENSITIVE_PATTERNS['api-key'].regex.test(html)) {
    fields.push({
      type: 'api-key',
      selector: 'input[name*="api" i]',
      reason: 'API key pattern detected',
    });
  }

  return fields;
}

/**
 * Sanitize extracted text by removing sensitive data
 */
export function sanitizeText(text: string): MinimizerResult {
  let sanitized = text;
  const detected: SensitiveField[] = [];

  // Mask credit card numbers
  if (SENSITIVE_PATTERNS['credit-card'].regex.test(text)) {
    sanitized = sanitized.replace(
      SENSITIVE_PATTERNS['credit-card'].regex,
      '[CREDIT_CARD_MASKED]'
    );
    detected.push({
      type: 'credit-card',
      selector: '',
      reason: 'Credit card number sanitized',
    });
  }

  // Mask SSN
  if (SENSITIVE_PATTERNS.ssn.regex.test(text)) {
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.ssn.regex, '[SSN_MASKED]');
    detected.push({
      type: 'ssn',
      selector: '',
      reason: 'SSN sanitized',
    });
  }

  // Mask API keys
  if (SENSITIVE_PATTERNS['api-key'].regex.test(text)) {
    sanitized = sanitized.replace(SENSITIVE_PATTERNS['api-key'].regex, '[API_KEY_MASKED]');
    detected.push({
      type: 'api-key',
      selector: '',
      reason: 'API key sanitized',
    });
  }

  if (detected.length > 0) {
    return {
      allowed: true,
      sanitized,
      detectedFields: detected,
    };
  }

  return { allowed: true };
}

/**
 * Check if extraction query is allowed
 */
export function checkExtraction(query: string, selector?: string): MinimizerResult {
  const lowerQuery = query.toLowerCase();

  // Check for suspicious keywords in query
  const suspiciousKeywords = [
    'password',
    'credit',
    'card',
    'cvv',
    'ssn',
    'social security',
    'secret',
    'apikey',
    'api_key',
    'token',
    'auth',
  ];

  const foundKeywords = suspiciousKeywords.filter(k => lowerQuery.includes(k));
  
  if (foundKeywords.length > 0) {
    return {
      allowed: false,
      reason: `Extraction query contains sensitive keywords: ${foundKeywords.join(', ')}`,
    };
  }

  // Check selector if provided
  if (selector) {
    const sensitiveSelectors = [
      'input[type="password"]',
      '[type="password"]',
      'input[name*="password"]',
      'input[name*="card"]',
      'input[autocomplete="cc-',
    ];

    const matchesSensitive = sensitiveSelectors.some(s => 
      selector.toLowerCase().includes(s.toLowerCase())
    );

    if (matchesSensitive) {
      return {
        allowed: false,
        reason: 'Extraction targets sensitive input field',
      };
    }
  }

  return { allowed: true };
}

/**
 * Block action if it targets sensitive elements
 */
export function checkActionAllowed(action: string, target?: string): MinimizerResult {
  const sensitiveActions: Record<string, string[]> = {
    'type': ['input[type="password"]', '[type="password"]'],
    'extract': ['input[type="password"]', '[type="password"]', 'input[autocomplete="cc-'],
    'click': ['button[type="submit"]', '[type="submit"]'],
  };

  const blockedSelectors = sensitiveActions[action.toLowerCase()];
  
  if (blockedSelectors && target) {
    const isSensitive = blockedSelectors.some(s => 
      target.toLowerCase().includes(s.toLowerCase())
    );

    if (isSensitive) {
      return {
        allowed: false,
        reason: `Action '${action}' targets sensitive element`,
      };
    }
  }

  return { allowed: true };
}
