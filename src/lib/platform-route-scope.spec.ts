import { describe, expect, it } from 'vitest';

const localePageFiles = Object.keys(
  import.meta.glob('../app/[[]locale]/**/page.{ts,tsx}'),
);
const restrictedPlatformRouteSegment =
  /^(?:platform.*|operations?.*|ops(?:[-_].*)?|admin(?:istration)?.*|console.*|configuration.*|config(?:uration)?.*)$/i;

describe('Platform V1 route scope', () => {
  it('does not register Platform, Operations or Configuration page routes', () => {
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

    expect(restrictedRoutes).toEqual([]);
  });
});
