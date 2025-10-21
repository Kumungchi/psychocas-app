export const DEFAULT_REDIRECT = '/home';

const PROTOCOL_PATTERN = /:\/\//;

const isSafeRelative = (path: string): boolean => {
  if (path.length === 0) {
    return false;
  }

  if (!path.startsWith('/')) {
    return false;
  }

  if (path.startsWith('//')) {
    return false;
  }

  if (PROTOCOL_PATTERN.test(path)) {
    return false;
  }

  return true;
};

export const isSafeRelativePath = (path: string | null): boolean => {
  if (!path) {
    return false;
  }

  return isSafeRelative(path.trim());
};

export const sanitizeRedirect = (path: string | null, fallback: string = DEFAULT_REDIRECT): string => {
  if (!path) {
    return fallback;
  }

  const trimmed = path.trim();
  return isSafeRelative(trimmed) ? trimmed : fallback;
};
