import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

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

export function createForwardHeaders(source: Headers, trustedEdgeHops = 0): Headers {
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

  if (trustedEdgeHops > 0) {
    const raw = source.get('x-forwarded-for');
    const addresses = raw && raw.length <= 256
      ? raw.split(',').map((address) => address.trim())
      : [];
    const clientIp = addresses[addresses.length - trustedEdgeHops];
    if (!clientIp || !isIP(clientIp)) {
      throw new Error('Trusted client IP is unavailable');
    }
    target.set('x-forwarded-for', clientIp);
  }

  return target;
}

export function trustedEdgeHops(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  if (!/^[0-5]$/.test(value)) throw new Error('Trusted client IP configuration is invalid');
  return Number(value);
}
