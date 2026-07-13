'use client';

import type { ReactNode } from 'react';
import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';
import { ConvexReactClient } from 'convex/react';
import { convexUrl } from '@/lib/convex/config';

let convex: ConvexReactClient | null = null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  convex ??= new ConvexReactClient(convexUrl);

  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
