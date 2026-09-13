import { STAGEHAND_SDK_VERSION } from "./version.js";

const STAGEHAND_SDK_IDENTITY = {
  name: "allternit-browser-runtime-sdk-ts",
  language: "typescript",
  version: STAGEHAND_SDK_VERSION,
} as const;

export const STAGEHAND_SDK_CLIENT_INFO = {
  name: STAGEHAND_SDK_IDENTITY.name,
  version: STAGEHAND_SDK_IDENTITY.version,
} as const;

export const STAGEHAND_SESSION_METADATA = {
  allternit_browser_runtime: "true",
  allternit_browser_runtime_sdk_language: STAGEHAND_SDK_IDENTITY.language,
  allternit_browser_runtime_sdk_version: STAGEHAND_SDK_IDENTITY.version,
} as const;
