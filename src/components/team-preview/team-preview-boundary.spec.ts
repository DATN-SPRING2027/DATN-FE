import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const source = path.resolve(process.cwd(), "src");
const files = readdirSync(source, { recursive: true })
  .map(String)
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.(spec|test)\./.test(file));

it("loads the fixture only through the gated development Project workspace", () => {
  const projectDetail = readFileSync(
    path.join(source, "components/projects/ProjectDetail.tsx"),
    "utf8",
  );
  const projectRoute = readFileSync(
    path.join(source, "app/[locale]/(admin)/projects/[projectId]/page.tsx"),
    "utf8",
  );
  expect(projectDetail).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(/);
  expect(projectDetail).toMatch(/teamMode === "fixture"/);
  expect(projectRoute).toMatch(/teamFixturePreviewEnabled\(/);
  expect(projectRoute).toMatch(/teamMode=\{fixturePreview \? "fixture" : "api"\}/);

  for (const file of files.filter(
    (file) =>
      !file.startsWith(`components${path.sep}team-preview${path.sep}`) &&
      file !== `components${path.sep}projects${path.sep}ProjectDetail.tsx`,
  )) {
    expect(readFileSync(path.join(source, file), "utf8"), file).not.toMatch(
      /team-preview|TeamPreview|previews\/team-foundation/,
    );
  }
});

it("keeps the fixture feature free of transport, API DTOs and browser persistence", () => {
  for (const file of files.filter((file) =>
    file.startsWith(`components${path.sep}team-preview${path.sep}`),
  )) {
    expect(readFileSync(path.join(source, file), "utf8"), file).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|apiClient|localStorage|sessionStorage)\b|@\/lib\//,
    );
  }
});
