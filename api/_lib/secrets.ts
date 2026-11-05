/**
 * RSA key handling for BYO model keys.
 *
 * Users encrypt their model API keys with the server's RSA public key BEFORE
 * uploading. The server stores only ciphertext and decrypts in-memory at the
 * exact moment a model call is made — never logged, never persisted in
 * plaintext.
 *
 * Provide PEMs via env:
 *   PUBLIC_RSA_KEY  (PEM SPKI)
 *   PRIVATE_RSA_KEY (PEM PKCS8)
 * If absent, an ephemeral pair is generated at boot (works for dev; keys are
 * lost on restart, so previously stored ciphertext cannot be decrypted after
 * a restart).
 */

import crypto from 'node:crypto';

const PUBLIC_ENV = process.env.PUBLIC_RSA_KEY?.trim();
const PRIVATE_ENV = process.env.PRIVATE_RSA_KEY?.trim();

interface KeyPair {
  publicPem: string;
  privatePem: string;
}

let ephemeral: KeyPair | null = null;

function getEphemeral(): KeyPair {
  if (!ephemeral) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    ephemeral = { publicPem: publicKey, privatePem: privateKey };
  }
  return ephemeral;
}

export function getPublicKeyPem(): string {
  return PUBLIC_ENV || getEphemeral().publicPem;
}

export function getPrivateKeyPem(): string {
  return PRIVATE_ENV || getEphemeral().privatePem;
}

/** Decrypt an RSA-OAEP ciphertext (base64) → plaintext. */
export function decryptKey(ciphertextB64: string): string {
  const privateKey = crypto.createPrivateKey(getPrivateKeyPem());
  const decrypted = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(ciphertextB64, 'base64')
  );
  return decrypted.toString('utf8');
}
