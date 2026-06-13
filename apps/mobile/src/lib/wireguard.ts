import * as nacl from 'tweetnacl';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    privateKey: Buffer.from(pair.secretKey).toString('base64'),
    publicKey: Buffer.from(pair.publicKey).toString('base64'),
  };
}
