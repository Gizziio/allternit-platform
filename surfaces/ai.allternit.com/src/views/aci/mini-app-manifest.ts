import type { MiniAppManifest } from "./mini-app.types";

export function validateMiniAppManifest(
  value: unknown,
):
  | { valid: true; manifest: MiniAppManifest }
  | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object")
    return { valid: false, errors: ["Manifest must be an object."] };
  const item = value as Partial<MiniAppManifest>;
  if (!item.id || !/^[a-z0-9][a-z0-9:._/-]{1,199}$/i.test(item.id))
    errors.push("A valid id is required.");
  if (!item.name?.trim()) errors.push("A name is required.");
  if (!item.description?.trim()) errors.push("A description is required.");
  if (!item.category) errors.push("A category is required.");
  if (
    item.presentation?.mode !== "native" &&
    item.presentation?.mode &&
    !item.presentation.uiUrl
  )
    errors.push("Embedded and hybrid presentations require uiUrl.");
  for (const command of [
    item.lifecycle?.install?.command,
    item.lifecycle?.start?.command,
    item.lifecycle?.stop?.command,
  ].filter(Boolean) as string[]) {
    if (command.length > 4096 || command.includes("\0"))
      errors.push(
        "Runtime commands must be shorter than 4096 characters and contain no null bytes.",
      );
  }
  return errors.length
    ? { valid: false, errors }
    : { valid: true, manifest: item as MiniAppManifest };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Canonical manifest serialization for signatures: recursive key sorting and
 * undefined-stripping, then JSON.stringify. Signers and verifiers MUST share
 * exactly this transform — never reimplement it per call site.
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export async function verifyMiniAppManifestSignature(
  manifest: MiniAppManifest,
): Promise<boolean> {
  const signature = manifest.release?.signature;
  const publisherKey = manifest.release?.publisherKey;
  if (!signature || !publisherKey || !globalThis.crypto?.subtle) return false;
  try {
    const unsigned = {
      ...manifest,
      release: { ...manifest.release, signature: undefined },
    };
    const key = await crypto.subtle.importKey(
      "raw",
      decodeBase64(publisherKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signature),
      new TextEncoder().encode(JSON.stringify(canonicalize(unsigned))),
    );
  } catch {
    return false;
  }
}
