/**
 * Password-manager CSV import parsers.
 *
 * Supports:
 *   - 1Password (.1pif, .csv)
 *   - Apple Passwords / iCloud Keychain (csv)
 *   - Bitwarden (csv)
 *   - Dashlane (csv)
 *   - Google Chrome / Chromium (csv)
 *   - LastPass (csv)
 *   - Generic CSV with common column names
 *
 * All parsing is done locally in the extension; passwords are sent to the
 * gateway one at a time over the existing authenticated vault API.
 */

export interface ImportCredential {
  provider: string;
  username: string;
  password: string;
  originPattern: string;
}

export type ImportFormat =
  | '1password'
  | 'apple'
  | 'bitwarden'
  | 'chrome'
  | 'dashlane'
  | 'generic'
  | 'lastpass'
  | 'unknown';

function normalizeOrigin(url: string): string {
  if (!url) return '';
  const trimmed = url.trim().toLowerCase();
  try {
    const { hostname } = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0] ?? trimmed;
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function pickColumn(row: string[], headers: string[], candidates: string[]): string {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate.toLowerCase());
    if (index >= 0 && index < row.length) {
      return row[index].trim();
    }
  }
  return '';
}

function detectFormat(headers: string[]): ImportFormat {
  const headerSet = new Set(headers);

  // Dashlane: unique columns not used by the other exporters.
  if (
    headerSet.has('otpurl') ||
    headerSet.has('username2') ||
    headerSet.has('username3') ||
    (headerSet.has('category') && headerSet.has('note'))
  ) {
    return 'dashlane';
  }

  // LastPass: classic export columns.
  if (headerSet.has('grouping') && headerSet.has('fav')) {
    return 'lastpass';
  }

  // Apple Passwords: Title/URL/Username/Password/Notes/OTPAuth.
  if (
    headerSet.has('title') &&
    headerSet.has('url') &&
    headerSet.has('username') &&
    headerSet.has('password') &&
    !headerSet.has('name') &&
    !headerSet.has('website')
  ) {
    return 'apple';
  }

  if (headerSet.has('login_username') || headerSet.has('login_uri')) return 'bitwarden';
  if (headerSet.has('website')) return '1password';
  if (headerSet.has('name') && headerSet.has('url') && headerSet.has('username') && headerSet.has('password')) {
    return 'chrome';
  }
  if (headerSet.has('username') && headerSet.has('password')) return 'generic';
  return 'unknown';
}

function rowToCredential(row: string[], headers: string[], format: ImportFormat): ImportCredential | null {
  let provider = '';
  let username = '';
  let password = '';
  let originPattern = '';

  switch (format) {
    case '1password':
      provider = pickColumn(row, headers, ['title', 'website']);
      username = pickColumn(row, headers, ['username', 'email', 'login_username']);
      password = pickColumn(row, headers, ['password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url', 'website', 'login_uri']));
      break;
    case 'apple':
      provider = pickColumn(row, headers, ['title']);
      username = pickColumn(row, headers, ['username', 'email']);
      password = pickColumn(row, headers, ['password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url']));
      break;
    case 'bitwarden':
      provider = pickColumn(row, headers, ['name']);
      username = pickColumn(row, headers, ['login_username', 'username', 'email']);
      password = pickColumn(row, headers, ['login_password', 'password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['login_uri', 'url', 'website']));
      break;
    case 'chrome':
      provider = pickColumn(row, headers, ['name']);
      username = pickColumn(row, headers, ['username', 'email']);
      password = pickColumn(row, headers, ['password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url', 'website']));
      break;
    case 'dashlane':
      provider = pickColumn(row, headers, ['title']);
      username = pickColumn(row, headers, ['username', 'email', 'login_username']);
      password = pickColumn(row, headers, ['password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url', 'website']));
      break;
    case 'lastpass':
      provider = pickColumn(row, headers, ['name']);
      username = pickColumn(row, headers, ['username', 'email']);
      password = pickColumn(row, headers, ['password']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url']));
      break;
    case 'generic':
      provider = pickColumn(row, headers, ['name', 'title', 'website', 'provider', 'site']);
      username = pickColumn(row, headers, ['username', 'email', 'login', 'user']);
      password = pickColumn(row, headers, ['password', 'pass', 'passwd', 'secret']);
      originPattern = normalizeOrigin(pickColumn(row, headers, ['url', 'website', 'origin', 'site', 'domain']));
      break;
    default:
      return null;
  }

  provider = provider || originPattern || 'Imported';
  username = username || '';
  password = password || '';
  originPattern = originPattern || '';

  if (!password) return null;
  return { provider, username, password, originPattern };
}

export function detectImportFormat(text: string): ImportFormat {
  const { headers } = parseCsv(text);
  return detectFormat(headers);
}

export function parsePasswordExport(text: string): { format: ImportFormat; credentials: ImportCredential[] } {
  const { headers, rows } = parseCsv(text);
  const format = detectFormat(headers);
  if (format === 'unknown') {
    return { format, credentials: [] };
  }

  const credentials: ImportCredential[] = [];
  for (const row of rows) {
    const cred = rowToCredential(row, headers, format);
    if (cred) {
      credentials.push(cred);
    }
  }
  return { format, credentials };
}

export function formatLabel(format: ImportFormat): string {
  switch (format) {
    case '1password':
      return '1Password';
    case 'apple':
      return 'Apple Passwords';
    case 'bitwarden':
      return 'Bitwarden';
    case 'chrome':
      return 'Chrome';
    case 'dashlane':
      return 'Dashlane';
    case 'lastpass':
      return 'LastPass';
    case 'generic':
      return 'Generic CSV';
    default:
      return 'Unknown format';
  }
}
