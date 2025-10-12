declare module "next-pwa" {
  import type { NextConfig } from "next";

  export type RuntimeCaching = {
    urlPattern: RegExp | ((context: { request: Request }) => boolean);
    handler: string;
    options?: {
      cacheName?: string;
      networkTimeoutSeconds?: number;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
    } & Record<string, unknown>;
  };

  type WithPWA = (config?: {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    cacheStartUrl?: boolean;
    runtimeCaching?: RuntimeCaching[];
    fallbacks?: {
      document?: string;
    };
  }) => (config: NextConfig) => NextConfig;

  const withPWA: WithPWA;
  export default withPWA;
}
