import { describe, expect, it } from 'vitest';
import { buildBackendUrl, createForwardHeaders } from './bff-proxy';

describe('BFF proxy boundary', () => {
  it('keeps the backend base URL fixed while encoding path segments', () => {
    expect(
      buildBackendUrl('http://backend:3001/api/v1/', ['health', 'a/b'], '?page=1'),
    ).toBe('http://backend:3001/api/v1/health/a%2Fb?page=1');
  });

  it('preserves trusted request headers and creates a request id', () => {
    const source = new Headers({
      authorization: 'Bearer test',
      cookie: 'session=test',
      'x-ignored': 'nope',
    });

    const forwarded = createForwardHeaders(source);

    expect(forwarded.get('authorization')).toBe('Bearer test');
    expect(forwarded.get('cookie')).toBe('session=test');
    expect(forwarded.get('x-ignored')).toBeNull();
    expect(forwarded.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('selects the IP appended by the trusted edge, excluding spoofed prefixes', () => {
    const source = new Headers({ 'x-forwarded-for': '192.0.2.9, 203.0.113.7' });
    const forwarded = createForwardHeaders(source, 1);
    expect(forwarded.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(createForwardHeaders(source, 0).get('x-forwarded-for')).toBeNull();
  });

  it('fails closed when a configured edge did not supply a valid address', () => {
    expect(() => createForwardHeaders(new Headers(), 1)).toThrow('Trusted client IP');
    expect(() => createForwardHeaders(new Headers({ 'x-forwarded-for': 'spoofed' }), 1)).toThrow('Trusted client IP');
  });
});
