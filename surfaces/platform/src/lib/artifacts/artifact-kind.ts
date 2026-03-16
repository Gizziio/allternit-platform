/**
 * Artifact kinds supported by the application
 */

export const ARTIFACT_KINDS = [
  "text",
  "code",
  "sheet",
  "image",
  "audio",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export function isValidArtifactKind(kind: string): kind is ArtifactKind {
  return ARTIFACT_KINDS.includes(kind as ArtifactKind);
}
