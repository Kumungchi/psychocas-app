const ALLOWED_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface TokenGeneratorOptions {
  random?: () => number;
}

export function generateTokenCode(options?: TokenGeneratorOptions): string {
  const random = options?.random ?? Math.random;
  const pick = (length: number) =>
    Array.from({ length }, () => {
      const index = Math.floor(random() * ALLOWED_CHARACTERS.length);
      return ALLOWED_CHARACTERS[index] ?? 'A';
    }).join('');

  return `${pick(4)}-${pick(4)}`;
}

export function isValidTokenFormat(token: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(token);
}
