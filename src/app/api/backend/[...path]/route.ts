import { getServerApiBaseUrl } from '@/lib/api-client';
import { buildBackendUrl, createForwardHeaders } from '@/lib/bff-proxy';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const backendResponse = await fetch(
    buildBackendUrl(getServerApiBaseUrl(), path, request.nextUrl.search),
    {
      method: request.method,
      headers: createForwardHeaders(request.headers),
      body,
      cache: 'no-store',
    },
  );
  const responseHeaders = new Headers();

  for (const name of ['cache-control', 'content-type', 'location', 'set-cookie']) {
    const value = backendResponse.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
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
