import { randomUUID } from 'node:crypto';

export const BFF_API_BASE_PATH = '/api/backend';

const forwardedHeaders = [
  'accept',
  'authorization',
  'content-type',
  'cookie',
  'x-request-id',
];

export function buildBackendUrl(
  baseUrl: string,
  path: readonly string[],
  search: string,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${normalizedBaseUrl}/${normalizedPath}${search}`;
}

export function createForwardHeaders(source: Headers): Headers {
  const target = new Headers();

  for (const name of forwardedHeaders) {
    const value = source.get(name);
    if (value) {
      target.set(name, value);
    }
  }

  if (!target.has('x-request-id')) {
    target.set('x-request-id', randomUUID());
  }

  return target;
}
