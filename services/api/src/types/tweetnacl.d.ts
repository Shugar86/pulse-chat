declare module 'tweetnacl' {
  export interface BoxKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export namespace box {
    export function keyPair(): BoxKeyPair;
  }
}
