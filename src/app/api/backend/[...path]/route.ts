import { getServerApiBaseUrl } from '@/lib/api-client';
import { buildBackendUrl, createForwardHeaders, trustedEdgeHops } from '@/lib/bff-proxy';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  let headers: Headers;
  try {
    const login = request.method === 'POST' && path.join('/') === 'auth/login';
    const edgeHops = login ? trustedEdgeHops(process.env.CONTINUUM_TRUSTED_EDGE_HOPS) : 0;
    if (login && process.env.NODE_ENV === 'production' && edgeHops === 0) {
      throw new Error('Trusted client IP is required in production');
    }
    headers = createForwardHeaders(
      request.headers,
      edgeHops,
    );
  } catch {
    return Response.json(
      { code: 'SOURCE_IP_UNAVAILABLE', message: 'Trusted client IP is unavailable.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const backendResponse = await fetch(
    buildBackendUrl(getServerApiBaseUrl(), path, request.nextUrl.search),
    {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    },
  );
  const responseHeaders = new Headers();

  for (const name of ['cache-control', 'content-type', 'location']) {
    const value = backendResponse.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of backendResponse.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
