import { describe, expect, it } from 'vitest';
import {
  productionConvexSiteUrl,
  productionConvexUrl,
  resolveConvexSiteUrl,
  resolveConvexUrl,
} from '@/lib/convex/config';

describe('Convex deployment configuration', () => {
  it('uses the production EU deployment when a hosting environment omits public variables', () => {
    expect(resolveConvexUrl()).toBe(productionConvexUrl);
    expect(resolveConvexSiteUrl()).toBe(productionConvexSiteUrl);
  });

  it('preserves explicit development deployment URLs', () => {
    expect(resolveConvexUrl(' https://example.convex.cloud/ ')).toBe(
      'https://example.convex.cloud',
    );
    expect(resolveConvexSiteUrl(undefined, 'https://example.convex.cloud')).toBe(
      'https://example.convex.site',
    );
  });
});
