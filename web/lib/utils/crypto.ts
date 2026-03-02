/**
 * Crypto utilities for vault encryption
 * 
 * Gate: AUTH-2
 * Task: 1.4@AUTH-2
 */

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

/**
 * Encrypt plaintext using AES-GCM
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: Array.from(new Uint8Array(ciphertext)).join(','),
    iv: Array.from(iv).join(','),
  };
}

/**
 * Decrypt ciphertext using AES-GCM
 */
export async function decrypt(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const decoder = new TextDecoder();
  
  const ciphertextArray = new Uint8Array(
    ciphertext.split(',').map(Number)
  );
  const ivArray = new Uint8Array(
    iv.split(',').map(Number)
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    ciphertextArray
  );

  return decoder.decode(decrypted);
}

/**
 * Generate a random key for vault encryption
 */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
