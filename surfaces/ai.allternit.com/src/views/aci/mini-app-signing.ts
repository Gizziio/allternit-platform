/**
 * Publisher manifest signing (Ed25519, WebCrypto).
 *
 * Private keys never leave the publisher's machine: generation and import
 * happen locally, keys are exported only for the publisher's own backup, and
 * the registry ever sees just the public key. Signatures cover the manifest
 * with `release.signature` removed, serialized through the shared
 * canonicalizer in `mini-app-manifest.ts` — the exact transform the
 * marketplace client and desktop installer verify against.
 */

import { canonicalize } from "./mini-app-manifest";
import type { MiniAppManifest } from "./mini-app.types";

export interface GeneratedSigningKey {
  /** Base64 (standard) 32-byte Ed25519 public key; goes into the manifest. */
  publicKey: string;
  /** Base64 PKCS#8 private key; the publisher stores this themselves. */
  privateKeyPkcs8: string;
}

const textEncoder = new TextEncoder();

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** WebCrypto Ed25519 requires a recent Chromium/Firefox/Safari. */
export function isManifestSigningAvailable(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

/** Generate a new publisher signing key. The private key is exportable so the
 * publisher can back it up; nothing is persisted by the app. */
export async function generateSigningKey(): Promise<GeneratedSigningKey> {
  if (!isManifestSigningAvailable()) {
    throw new Error("This environment does not support Ed25519 WebCrypto operations.");
  }
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    publicKey: encodeBase64(new Uint8Array(raw)),
    privateKeyPkcs8: encodeBase64(new Uint8Array(pkcs8)),
  };
}

/** Import a previously exported PKCS#8 private key, deriving its public key. */
export async function importSigningKey(
  privateKeyPkcs8: string,
): Promise<{ key: CryptoKey; publicKey: string }> {
  if (!isManifestSigningAvailable()) {
    throw new Error("This environment does not support Ed25519 WebCrypto operations.");
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64(privateKeyPkcs8.trim()),
    { name: "Ed25519" },
    true,
    ["sign"],
  );
  // Derive the public half via JWK (PKCS#8 imports cannot re-export raw public).
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const publicJwk: JsonWebKey = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, ext: true };
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return { key, publicKey: encodeBase64(new Uint8Array(raw)) };
}

/** The exact bytes a signature covers. Exported for tests and tooling. */
export function manifestSigningPayload(manifest: MiniAppManifest): Uint8Array {
  const unsigned = {
    ...(manifest as unknown as Record<string, unknown>),
    release: {
      ...((manifest.release as unknown as Record<string, unknown>) ?? {}),
      signature: undefined,
    },
  };
  return textEncoder.encode(JSON.stringify(canonicalize(unsigned)));
}

/**
 * Sign a manifest: returns a copy with `release.signature` and
 * `release.publisherKey` set. The input manifest is not mutated.
 *
 * The payload is computed AFTER attaching `publisherKey`: verifiers strip
 * only `signature`, so the public key itself is part of the signed bytes.
 */
export async function signManifest(
  manifest: MiniAppManifest,
  key: CryptoKey,
  publicKey: string,
): Promise<MiniAppManifest> {
  const withKey: MiniAppManifest = {
    ...manifest,
    release: { ...manifest.release, publisherKey: publicKey },
  };
  const signature = await crypto.subtle.sign(
    "Ed25519",
    key,
    manifestSigningPayload(withKey) as BufferSource,
  );
  return {
    ...withKey,
    release: {
      ...withKey.release,
      signature: encodeBase64(new Uint8Array(signature)),
    },
  };
}
