// Re-export from shared/utils
export * from '../shared/utils/auth.js'

/** AWS credential refresh for Bedrock-backed calls; no cloud creds in this build. */
export async function refreshAndGetAwsCredentials(): Promise<null> {
  return null
}

/** GCP credential refresh for Vertex-backed calls; no cloud creds in this build. */
export async function refreshGcpCredentialsIfNeeded(): Promise<void> {}
