import type { LLMConfig } from '@page-agent/llms'

/** Gizzi runtime on the Allternit desktop. Not a third-party LLM proxy. */
export const PLATFORM_MODEL = 'gizzi'
export const PLATFORM_BASE_URL = 'http://127.0.0.1:4096'
export const PLATFORM_API_KEY = 'platform'

export const DEMO_MODEL = PLATFORM_MODEL
export const DEMO_BASE_URL = PLATFORM_BASE_URL
export const DEMO_API_KEY = PLATFORM_API_KEY

export const DEMO_CONFIG: LLMConfig = {
	apiKey: PLATFORM_API_KEY,
	baseURL: PLATFORM_BASE_URL,
	model: PLATFORM_MODEL,
}

/** Legacy testing endpoints that should be auto-migrated to the Gizzi runtime */
export const LEGACY_TESTING_ENDPOINTS = [
	'https://hwcxiuzfylggtcktqgij.supabase.co/functions/v1/llm-testing-proxy',
	'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
]

export function isTestingEndpoint(url: string): boolean {
	const normalized = url.replace(/\/+$/, '')
	return normalized === DEMO_BASE_URL || LEGACY_TESTING_ENDPOINTS.some((ep) => normalized === ep)
}

export function migrateLegacyEndpoint(config: LLMConfig): LLMConfig {
	const normalized = config.baseURL.replace(/\/+$/, '')
	if (LEGACY_TESTING_ENDPOINTS.some((ep) => normalized === ep)) {
		return { ...DEMO_CONFIG }
	}
	return config
}
