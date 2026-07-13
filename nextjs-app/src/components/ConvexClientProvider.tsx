'use client';

import type { ReactNode } from 'react';
import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';
import { ConvexReactClient } from 'convex/react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
let convex: ConvexReactClient | null = null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    throw new Error('Missing NEXT_PUBLIC_CONVEX_URL for Convex client provider.');
  }

  convex ??= new ConvexReactClient(convexUrl);

  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
