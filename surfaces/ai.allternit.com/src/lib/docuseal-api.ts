/**
 * DocuSeal API client for Allternit Sign.
 *
 * DocuSeal is the open-source DocuSign alternative we embed natively in
 * Allternit Office. This thin client covers the subset of the REST API we
 * need to list templates, create signature requests, and obtain embed URLs.
 *
 * @see https://www.docuseal.com/docs/embedded/form/js
 * @see https://www.docuseal.com/guides/send-documents-for-signature-via-api
 */

const DEFAULT_HOST = process.env.NEXT_PUBLIC_DOCUSEAL_HOST ?? 'https://api.docuseal.com';

export interface DocuSealTemplate {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface DocuSealSubmitter {
  email: string;
  role?: string;
  slug?: string;
  embed_src?: string;
  status?: 'pending' | 'opened' | 'completed' | 'declined';
}

export interface DocuSealSubmission {
  id: number;
  template_id: number;
  submitters: DocuSealSubmitter[];
  status?: string;
  created_at?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function docusealRequest<T>(
  path: string,
  apiKey: string,
  host: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${host.replace(/\/$/, '')}${path}`;
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      'X-Auth-Token': apiKey,
      ...options.headers,
    },
  };
  if (options.body) {
    init.body = options.body instanceof FormData ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const text = await response.text().catch(() => '');
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: string }).error)
        : `DocuSeal API ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function getDocuSealConfig(): { apiKey: string; host: string } {
  const apiKey =
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('allternit.docuseal.apiKey')
      : null) ??
    process.env.NEXT_PUBLIC_DOCUSEAL_API_KEY ??
    '';
  const host =
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('allternit.docuseal.host')
      : null) ??
    DEFAULT_HOST;
  return { apiKey, host };
}

export function setDocuSealConfig(apiKey: string, host?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('allternit.docuseal.apiKey', apiKey);
  if (host) window.localStorage.setItem('allternit.docuseal.host', host);
}

export async function listDocuSealTemplates(): Promise<DocuSealTemplate[]> {
  const { apiKey, host } = getDocuSealConfig();
  if (!apiKey) throw new Error('DocuSeal API key is not configured');
  return docusealRequest<DocuSealTemplate[]>('/templates', apiKey, host);
}

export async function createDocuSealSubmission(input: {
  templateId: number;
  sendEmail?: boolean;
  submitters: Array<{ email: string; role?: string }>;
  message?: { subject?: string; body?: string };
}): Promise<DocuSealSubmission> {
  const { apiKey, host } = getDocuSealConfig();
  if (!apiKey) throw new Error('DocuSeal API key is not configured');

  return docusealRequest<DocuSealSubmission>('/submissions', apiKey, host, {
    method: 'POST',
    body: {
      template_id: input.templateId,
      send_email: input.sendEmail ?? false,
      message: input.message,
      submitters: input.submitters,
    },
  });
}

export async function createDocuSealTemplateFromPdf(
  file: File,
  name?: string,
): Promise<DocuSealTemplate> {
  const { apiKey, host } = getDocuSealConfig();
  if (!apiKey) throw new Error('DocuSeal API key is not configured');

  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  return docusealRequest<DocuSealTemplate>('/templates/pdf', apiKey, host, {
    method: 'POST',
    body: formData,
  });
}

export function getDocuSealEmbedUrl(submitterSlug: string, host?: string): string {
  const baseHost = (host ?? getDocuSealConfig().host)
    .replace('/api', '')
    .replace(/\/$/, '');
  return `${baseHost}/s/${submitterSlug}`;
}
