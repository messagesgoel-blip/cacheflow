/**
 * Credential Vault — AES-256-GCM encrypted storage for VPS/WebDAV credentials
 *
 * Gate: SEC-1
 * Task: 4.5
 *
 * Encrypts VPS (password/private-key) and WebDAV (username/password) credentials
 * at rest using AES-256-GCM.  Key is derived from TOKEN_ENCRYPTION_KEY env var
 * (same key as tokenVault — reuses the existing deriveKey convention).
 *
 * Wire format produced by encryptCredential():
 *   "<iv_hex>:<authTag_hex>:<ciphertext_hex>:<version>"
 *
 * Persistence target: `user_remotes.access_token_enc` (Prisma: UserRemote model).
 *
 * SEC-1 requirements enforced:
 *   - No plaintext secrets in logs, events, or serialised responses.
 *   - TOKEN_ENCRYPTION_KEY must be set; throws on first use if absent.
 *   - GCM authentication tag is always verified on decrypt; tampered
 *     ciphertext throws immediately.
 */

import crypto from 'crypto';
import { utils } from 'ssh2';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm' as const;
const ENCRYPTION_VERSION = 1;

// ---------------------------------------------------------------------------
// Credential shapes
// ---------------------------------------------------------------------------

/** VPS / SFTP credential bundle stored in the vault. */
export interface VPSCredentialPayload {
  kind: 'vps';
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  /** Present when authType === 'password'. Never logged or returned to client. */
  password?: string;
  /** PEM-encoded private key. Present when authType === 'key'. Never logged. */
  privateKey?: string;
  /** Optional passphrase for an encrypted private key. Never logged. */
  passphrase?: string;
  rootPath: string;
}

/** WebDAV credential bundle stored in the vault. */
export interface WebDAVCredentialPayload {
  kind: 'webdav';
  url: string;
  username: string;
  /** Basic-auth password. Never logged or returned to client. */
  password: string;
  /** Optional base path prefix, e.g. '/dav/'. */
  basePath?: string;
}

export type CredentialPayload = VPSCredentialPayload | WebDAVCredentialPayload;

/** Opaque encrypted string produced by encryptCredential(). */
export type EncryptedCredential = string;

// ---------------------------------------------------------------------------
// Key derivation — mirrors tokenVault.deriveKey() convention
// ---------------------------------------------------------------------------

/**
 * Derives a 32-byte AES key from TOKEN_ENCRYPTION_KEY.
 * Throws if the env var is absent — SEC-1 forbids silent fallback defaults.
 */
function deriveKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[credentialVault] TOKEN_ENCRYPTION_KEY is not set. ' +
        'Configure it before using the vault.'
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length >= 32) return buf.slice(0, 32);
  // Pad with zeros when hex decodes to fewer than 32 bytes (dev convenience).
  const padded = Buffer.alloc(32);
  buf.copy(padded);
  return padded;
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt primitives
// ---------------------------------------------------------------------------

/**
 * Encrypts a CredentialPayload as JSON using AES-256-GCM.
 *
 * Returns `"<iv_hex>:<authTag_hex>:<ciphertext_hex>:<version>"`.
 * All four colon-delimited segments are required for round-trip decryption.
 *
 * @throws If TOKEN_ENCRYPTION_KEY is not set.
 */
export function encryptCredential(payload: CredentialPayload): EncryptedCredential {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(payload);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${ciphertext}:${ENCRYPTION_VERSION}`;
}

/**
 * Decrypts a value produced by encryptCredential().
 *
 * GCM authentication failure (wrong key or tampered data) throws immediately
 * — this is intentional SEC-1 behaviour.
 *
 * @throws On malformed format, wrong key, or tampered ciphertext.
 */
export function decryptCredential(encrypted: EncryptedCredential): CredentialPayload {
  const parts = encrypted.split(':');
  if (parts.length !== 4) {
    throw new Error(
      `[credentialVault] Invalid ciphertext format ` +
        `(expected 4 segments, got ${parts.length})`
    );
  }
  const [ivHex, authTagHex, ciphertext] = parts;
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return JSON.parse(plaintext) as CredentialPayload;
}

// ---------------------------------------------------------------------------
// CredentialVault — thin wrapper providing typed encrypt/decrypt + rotation
// ---------------------------------------------------------------------------

/**
 * CredentialVault provides typed, AES-256-GCM encrypted storage for
 * VPS and WebDAV credentials.
 *
 * Usage pattern:
 * ```ts
 * const vault = getCredentialVault();
 * const enc = vault.encrypt(payload);
 * // persist `enc` to user_remotes.access_token_enc
 *
 * const dec = vault.decrypt(enc);
 * // use dec.password / dec.privateKey in SSH / HTTP requests
 * ```
 *
 * SEC-1 contract:
 * - `encrypt()` never logs the plaintext payload.
 * - `decrypt()` returns the plaintext only in memory; callers must not log it.
 * - GCM tag verification happens inside `decrypt()` — tampered values throw.
 */
export class CredentialVault {
  /**
   * Encrypts a VPS or WebDAV credential payload.
   * Throws if TOKEN_ENCRYPTION_KEY is unset.
   */
  encrypt(payload: CredentialPayload): EncryptedCredential {
    return encryptCredential(payload);
  }

  /**
   * Decrypts a previously encrypted credential.
   * Throws on wrong key, tampered data, or malformed format.
   */
  decrypt(encrypted: EncryptedCredential): CredentialPayload {
    return decryptCredential(encrypted);
  }

  /**
   * Re-encrypts a credential under the current key.
   * Use this when rotating TOKEN_ENCRYPTION_KEY: decrypt with old key,
   * call rotate() with the result to produce a new ciphertext under the
   * new key (after updating the env var).
   *
   * @param payload  Already-decrypted credential produced by decrypt().
   * @returns        Fresh ciphertext under the current TOKEN_ENCRYPTION_KEY.
   */
  rotate(payload: CredentialPayload): EncryptedCredential {
    return encryptCredential(payload);
  }

  /**
   * Generates a new SSH key pair (Ed25519).
   * Returns { publicKey, privateKey }.
   * publicKey is in OpenSSH authorized_keys format.
   * privateKey is in PEM format.
   */
  generateSSHKey(comment: string = 'cacheflow-vps'): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const parsed = utils.parseKey(publicKey);
    if (parsed instanceof Error) {
      throw new Error(`Failed to parse public key: ${parsed.message}`);
    }
    const publicSSH = `ssh-ed25519 ${parsed.getPublicSSH().toString('base64')} ${comment}`;

    return {
      publicKey: publicSSH,
      privateKey,
    };
  }

  /**
   * Extract OpenSSH public key from a PEM private key.
   */
  getPublicKeyFromPrivate(privateKey: string, comment: string = 'cacheflow-vps'): string {
    const parsed = utils.parseKey(privateKey);
    if (parsed instanceof Error) {
      throw new Error(`Failed to parse private key: ${parsed.message}`);
    }
    return `${parsed.type} ${parsed.getPublicSSH().toString('base64')} ${comment}`;
  }

  /**
   * Returns an opaque safe summary of a credential for logging.
   * NEVER includes passwords, private keys, or passphrases.
   */
  summary(payload: CredentialPayload): Record<string, unknown> {
    if (payload.kind === 'vps') {
      return {
        kind: payload.kind,
        host: payload.host,
        port: payload.port,
        username: payload.username,
        authType: payload.authType,
        rootPath: payload.rootPath,
      };
    }
    // WebDAV
    return {
      kind: payload.kind,
      url: payload.url,
      username: payload.username,
      basePath: payload.basePath,
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _credentialVault: CredentialVault | null = null;

export function getCredentialVault(): CredentialVault {
  if (!_credentialVault) _credentialVault = new CredentialVault();
  return _credentialVault;
}

/** Replaces the singleton — used in tests to inject a pre-configured instance. */
export function setCredentialVault(vault: CredentialVault): void {
  _credentialVault = vault;
}

export default CredentialVault;
