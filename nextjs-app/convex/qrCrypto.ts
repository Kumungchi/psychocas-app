const encoder = new TextEncoder();
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateQrSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function generateShortCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length]).join("");
}

export function normalizeShortCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isQrSecret(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

export async function hashQrValue(value: string, pepper = process.env.QR_TOKEN_PEPPER): Promise<string> {
  if (!pepper || pepper.length < 32) throw new Error("qr_token_pepper_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}
