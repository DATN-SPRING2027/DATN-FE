import { forwardBackendRequest } from '../forward';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  if (path.join('/') === 'auth/refresh') {
    return new Response(null, { status: 404 });
  }
  return forwardBackendRequest(request, path);
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
