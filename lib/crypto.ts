/**
 * Client-side RSA-OAEP encryption (WebCrypto) for BYO model keys.
 * The server's public key is fetched at runtime; the plaintext key never
 * leaves the browser except in encrypted form.
 */

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptWithPublicKey(publicPem: string, plaintext: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicPem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const cipher = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(plaintext)
  );
  const bytes = new Uint8Array(cipher);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
