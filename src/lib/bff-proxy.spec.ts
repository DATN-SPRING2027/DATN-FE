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
});
