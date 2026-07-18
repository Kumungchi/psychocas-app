import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';
import { api } from '../../../../convex/_generated/api';
import { convexUrl } from '@/lib/convex/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function GET() {
  const checkedAt = Date.now();
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const dependency = await convex.query(api.operations.publicHealth, {});
    return NextResponse.json(
      {
        status: 'ok',
        service: 'psychocas-web',
        checkedAt,
        dependencies: { convex: dependency },
      },
      { status: 200, headers: responseHeaders },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'unavailable',
        service: 'psychocas-web',
        checkedAt,
        dependencies: { convex: { status: 'unavailable' } },
      },
      { status: 503, headers: responseHeaders },
    );
  }
}
