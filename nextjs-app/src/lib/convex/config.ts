export const productionConvexUrl = 'https://opulent-fly-2.eu-west-1.convex.cloud';
export const productionConvexSiteUrl = 'https://opulent-fly-2.eu-west-1.convex.site';

export function resolveConvexUrl(configured?: string): string {
  return configured?.trim().replace(/\/$/, '') || productionConvexUrl;
}

export function resolveConvexSiteUrl(configuredSite?: string, configuredCloud?: string): string {
  const site = configuredSite?.trim();
  if (site) return site.replace(/\/$/, '');

  const cloud = configuredCloud?.trim();
  if (cloud) return cloud.replace(/\.convex\.cloud\/?$/, '.convex.site');

  return productionConvexSiteUrl;
}

export const convexUrl = resolveConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
export const convexSiteUrl = resolveConvexSiteUrl(
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  process.env.NEXT_PUBLIC_CONVEX_URL,
);
