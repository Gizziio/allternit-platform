import type { OfficeAiClient, OfficeStorageProvider } from '../bridge/types';

/**
 * Configuration passed to the suite's AI layer. Hosts inject their own client
 * so that platform, standalone, and desktop surfaces can use different backends
 * without the office apps knowing about it.
 */
export interface OfficeAiConfig {
  client: OfficeAiClient;
  storage?: OfficeStorageProvider;
  /** Default model id used when the user has not selected one. */
  defaultModelId?: string;
  /** True if the host wants the AI panel hidden by default. */
  disabled?: boolean;
}
