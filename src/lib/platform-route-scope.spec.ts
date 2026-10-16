import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const localeAppDirectory = join(process.cwd(), 'src', 'app', '[locale]');
const restrictedPlatformRouteSegment =
  /^(?:platform.*|operations?.*|ops(?:[-_].*)?|admin(?:istration)?.*|console.*|configuration.*|config(?:uration)?.*)$/i;

function collectPageRouteSegments(directory: string): string[][] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectPageRouteSegments(entryPath);
    if (!entry.isFile() || !/^page\.tsx?$/.test(entry.name)) return [];

    return [
      relative(localeAppDirectory, directory)
        .split(sep)
        .filter((segment) => segment && !/^\([^)]*\)$/.test(segment)),
    ];
  });
}

describe('Platform V1 route scope', () => {
  it('does not register Platform, Operations or Configuration page routes', () => {
    const restrictedRoutes = collectPageRouteSegments(localeAppDirectory)
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
