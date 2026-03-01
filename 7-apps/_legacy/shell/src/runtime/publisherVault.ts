export type VaultEntry = {
  id: string;
  publisherId: string;
  publicKeyId: string;
  publicKey: string;
  encryptedSecretKey: string;
  salt: string;
  iv: string;
  createdAt: number;
};

export type VaultState = {
  entries: VaultEntry[];
  activeKeyId?: string;
};

const VAULT_STORAGE_KEY = 'a2_publisher_vault';

const textEncoder = new TextEncoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => (
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
);

const getCrypto = (): Crypto => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure crypto is not available in this environment.');
  }
  return crypto;
};

const canonicalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b));
    const sorted: Record<string, unknown> = {};
    entries.forEach(([key, entryValue]) => {
      sorted[key] = canonicalizeJson(entryValue);
    });
    return sorted;
  }
  return value;
};

const deriveAesKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const cryptoApi = getCrypto();
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptSecretKey = async (secretKey: Uint8Array, passphrase: string) => {
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(passphrase, salt);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    secretKey
  );
  return {
    encryptedSecretKey: bytesToBase64(new Uint8Array(encrypted)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  };
};

const decryptSecretKey = async (entry: VaultEntry, passphrase: string): Promise<Uint8Array> => {
  const cryptoApi = getCrypto();
  const salt = base64ToBytes(entry.salt);
  const iv = base64ToBytes(entry.iv);
  const aesKey = await deriveAesKey(passphrase, salt);
  const encrypted = base64ToBytes(entry.encryptedSecretKey);
  const decrypted = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encrypted
  );
  return new Uint8Array(decrypted);
};

export const loadVault = (): VaultState => {
  if (typeof window === 'undefined') {
    return { entries: [] };
  }
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) {
    return { entries: [] };
  }
  try {
    const parsed = JSON.parse(raw) as VaultState;
    return {
      entries: parsed.entries || [],
      activeKeyId: parsed.activeKeyId,
    };
  } catch {
    return { entries: [] };
  }
};

export const saveVault = (state: VaultState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(state));
};

const generateEd25519Keypair = async () => {
  const cryptoApi = getCrypto();
  let keypair: CryptoKeyPair;
  try {
    keypair = await cryptoApi.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
  } catch {
    throw new Error('Ed25519 is not supported in this browser. Use the CLI to generate keys.');
  }
  const publicKey = new Uint8Array(await cryptoApi.subtle.exportKey('raw', keypair.publicKey));
  const secretKey = new Uint8Array(await cryptoApi.subtle.exportKey('pkcs8', keypair.privateKey));
  return { publicKey, secretKey };
};

export const generateVaultEntry = async (
  publisherId: string,
  publicKeyId: string,
  passphrase: string
) => {
  const keypair = await generateEd25519Keypair();
  const publicKey = bytesToBase64(keypair.publicKey);
  const encrypted = await encryptSecretKey(keypair.secretKey, passphrase);
  const entry: VaultEntry = {
    id: `${publisherId}:${publicKeyId}`,
    publisherId,
    publicKeyId,
    publicKey,
    encryptedSecretKey: encrypted.encryptedSecretKey,
    salt: encrypted.salt,
    iv: encrypted.iv,
    createdAt: Date.now(),
  };
  return { entry, secretKey: keypair.secretKey };
};

export const unlockVaultEntry = async (entry: VaultEntry, passphrase: string) => {
  return decryptSecretKey(entry, passphrase);
};

const hashSha256 = async (data: Uint8Array): Promise<Uint8Array> => {
  const cryptoApi = getCrypto();
  const digest = await cryptoApi.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
};

const signDigest = async (digest: Uint8Array, secretKey: Uint8Array) => {
  const cryptoApi = getCrypto();
  let key: CryptoKey;
  try {
    key = await cryptoApi.subtle.importKey(
      'pkcs8',
      secretKey,
      { name: 'Ed25519' },
      false,
      ['sign']
    );
  } catch {
    throw new Error('Invalid Ed25519 private key.');
  }
  const signature = await cryptoApi.subtle.sign({ name: 'Ed25519' }, key, digest);
  return bytesToBase64(new Uint8Array(signature));
};

export const signSkillPayload = async (skill: Record<string, unknown>, secretKey: Uint8Array) => {
  const payload = JSON.parse(JSON.stringify(skill)) as Record<string, unknown>;
  const manifest = payload.manifest as Record<string, unknown> | undefined;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Skill manifest is missing.');
  }
  const signature = (manifest.signature as Record<string, unknown>) || {};
  signature.manifest_sig = '';
  signature.bundle_hash = '';
  manifest.signature = signature;
  payload.manifest = manifest;
  const canonical = canonicalizeJson(payload);
  const encoded = textEncoder.encode(JSON.stringify(canonical));
  const digest = await hashSha256(encoded);
  const bundleHash = `sha256:${bytesToHex(digest)}`;
  const signatureB64 = await signDigest(digest, secretKey);
  return { manifest_sig: signatureB64, bundle_hash: bundleHash };
};

export const signAgentPayload = async (agent: Record<string, unknown>, secretKey: Uint8Array) => {
  const payload = JSON.parse(JSON.stringify(agent)) as Record<string, unknown>;
  const signature = (payload.signature as Record<string, unknown>) || {};
  signature.manifest_sig = '';
  signature.bundle_hash = '';
  payload.signature = signature;
  const canonical = canonicalizeJson(payload);
  const encoded = textEncoder.encode(JSON.stringify(canonical));
  const digest = await hashSha256(encoded);
  const bundleHash = `sha256:${bytesToHex(digest)}`;
  const signatureB64 = await signDigest(digest, secretKey);
  return { manifest_sig: signatureB64, bundle_hash: bundleHash };
};
