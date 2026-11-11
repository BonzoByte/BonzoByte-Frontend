/** Raw Brotli may begin with '[' or '{'; a prefix is not a JSON contract. */
export function decodeArchiveJson<T>(buffer: ArrayBuffer, decompress: (bytes: Uint8Array) => Uint8Array): T {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder();
  const head = text.decode(bytes.subarray(0, 32)).trim().toLowerCase();
  if (head.includes('<!doctype') || head.includes('<html')) {
    throw new Error('Got HTML instead of archive data.');
  }
  if (head.startsWith('{') || head.startsWith('[')) {
    try {
      // Require valid UTF-8 and a complete JSON document, not just one byte.
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T;
    } catch {
      // A compressed archive can legitimately have the same first byte.
    }
  }
  return JSON.parse(text.decode(decompress(bytes))) as T;
}
