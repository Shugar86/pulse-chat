import * as nacl from 'tweetnacl';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Buffer is a Node global and does not exist in React Native, so encode by hand.
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64_ALPHABET[(chunk >> 18) & 63] + BASE64_ALPHABET[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : '=';
  }
  return out;
}

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    privateKey: toBase64(pair.secretKey),
    publicKey: toBase64(pair.publicKey),
  };
}
