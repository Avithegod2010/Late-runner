/* ================================================================
   CODEC — UTF-8-safe base64url helpers shared by every share code
   (ghost links, palette links, profile export).

   - Output is URL-safe: "+/"" are mapped to "-_", padding stripped.
   - Input accepts both base64url and legacy standard base64.
   - Replaces the deprecated escape()/unescape() pair everywhere.
   ================================================================ */

/** URL-safe base64 of a byte array (padding stripped). */
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** UTF-8 encode a string into URL-safe base64. */
export function utf8ToB64url(s: string): string {
  return bytesToB64url(new TextEncoder().encode(s));
}

/**
 * Decode URL-safe (or standard) base64 back into raw bytes.
 * Accepts missing padding; returns null on any malformed input.
 * Note: the padding expression is intentional — "QQ=" needs 1 pad,
 * "QQ" needs 2, "Q" is invalid and throws inside atob.
 */
export function b64urlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/").trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) return null;
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Decode URL-safe (or standard) base64 into a UTF-8 string, or null. */
export function b64urlToUtf8(s: string): string | null {
  const bytes = b64urlToBytes(s);
  if (!bytes) return null;
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
