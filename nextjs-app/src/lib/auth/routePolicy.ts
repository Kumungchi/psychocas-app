export const PROTECTED_PATHS = [
  '/home',
  '/admin',
  '/workspace',
] as const;

export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((route) => matchesRoute(pathname, route));
}
