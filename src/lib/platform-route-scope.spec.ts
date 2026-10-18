import { describe, expect, it } from 'vitest';

const localePageFiles = Object.keys(
  import.meta.glob('../app/[[]locale]/**/page.{ts,tsx}'),
);
const restrictedPlatformRouteSegment =
  /^(?:platform.*|operations?.*|ops(?:[-_].*)?|admin(?:istration)?.*|console.*|configuration.*|config(?:uration)?.*)$/i;
const approvedPlatformRoutes = [
  '/platform',
  '/platform/account',
  '/platform/ai',
  '/platform/audit',
  '/platform/diagnostics',
  '/platform/incidents',
  '/platform/integrations',
  '/platform/jobs',
  '/platform/memberships',
  '/platform/organizations',
  '/platform/organizations/[organizationId]',
  '/platform/projects',
  '/platform/security',
  '/platform/services',
  '/platform/signin',
  '/platform/users',
].sort();

describe('Platform V1 route scope', () => {
  it('registers only approved Platform routes and no deferred routes', () => {
    expect(localePageFiles).toContain(
      '../app/[locale]/(admin)/dashboard/page.tsx',
    );

    const restrictedRoutes = localePageFiles
      .map((pagePath) =>
        pagePath
          .slice('../app/[locale]/'.length)
          .split('/')
          .slice(0, -1)
          .filter((segment) => segment && !/^\([^)]*\)$/.test(segment)),
      )
      .filter((segments) =>
        segments.some((segment) =>
          restrictedPlatformRouteSegment.test(segment),
        ),
      )
      .map((segments) => `/${segments.join('/')}`)
      .sort();

    const platformRoutes = restrictedRoutes.filter((route) =>
      route.startsWith('/platform'),
    );
    const deferredRoutes = restrictedRoutes.filter(
      (route) => !route.startsWith('/platform'),
    );

    expect(platformRoutes).toEqual(approvedPlatformRoutes);
    expect(deferredRoutes).toEqual([]);
  });
});
