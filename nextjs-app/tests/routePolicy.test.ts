import { describe, expect, it } from 'vitest';
import {
  isProtectedPath,
  matchesRoute,
} from '@/lib/auth/routePolicy';

describe('authentication route policy', () => {
  it('matches exact routes and descendants without prefix collisions', () => {
    expect(matchesRoute('/admin', '/admin')).toBe(true);
    expect(matchesRoute('/admin/members', '/admin')).toBe(true);
    expect(matchesRoute('/administrator', '/admin')).toBe(false);
  });

  it('protects member surfaces while leaving public validation open', () => {
    expect(isProtectedPath('/home')).toBe(true);
    expect(isProtectedPath('/admin/members')).toBe(true);
    expect(isProtectedPath('/v/public-token')).toBe(false);
  });

  it('does not protect removed legacy paths', () => {
    expect(isProtectedPath('/redeem')).toBe(false);
    expect(isProtectedPath('/stats/daily')).toBe(false);
  });
});
