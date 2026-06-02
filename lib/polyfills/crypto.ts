import * as ExpoCrypto from 'expo-crypto';

// Polyfill crypto.subtle.digest for PKCE S256 in Supabase auth.
// Hermes does not support WebCrypto, causing Supabase to fall back to plain
// PKCE which Supabase's server rejects. This ensures SHA-256 is always used.
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).crypto = {};
}

const cryptoGlobal = globalThis.crypto as unknown as Record<string, unknown>;

if (typeof cryptoGlobal.getRandomValues === 'undefined') {
  cryptoGlobal.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    const view = new Uint8Array((array as unknown as ArrayBufferView).buffer, (array as unknown as ArrayBufferView).byteOffset, array.byteLength);
    view.set(bytes);
    return array;
  };
}

if (typeof cryptoGlobal.subtle === 'undefined') {
  cryptoGlobal.subtle = {
    digest: async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
      const alg = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (alg.replace('-', '').toUpperCase() !== 'SHA256') {
        throw new Error(`Unsupported digest algorithm: ${alg}`);
      }
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array((data as ArrayBufferView).buffer);
      const hex = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...bytes),
        { encoding: ExpoCrypto.CryptoEncoding.HEX },
      );
      // Convert hex string to ArrayBuffer
      const result = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      return result.buffer;
    },
  } as SubtleCrypto;
}
