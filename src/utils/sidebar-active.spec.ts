import { expect, it } from "vitest";
import { isSidebarPathActive } from "./sidebar-active";

it.each(["/projects", "/projects/p1", "/projects/new", "/projects/p1/members"])(
  "keeps Projects active on %s",
  (pathname) => {
    expect(isSidebarPathActive("/projects", pathname)).toBe(true);
  },
);
it.each(["/", "/projects-other", "/projectsOther", "/users/projects"])(
  "does not match a different segment %s",
  (pathname) => {
    expect(isSidebarPathActive("/projects", pathname)).toBe(false);
  },
);
it("preserves exact matching for other navigation entries", () => {
  expect(isSidebarPathActive("/", "/projects/p1")).toBe(false);
  expect(isSidebarPathActive("/users", "/users/p1")).toBe(false);
  expect(isSidebarPathActive("/users", "/users")).toBe(true);
});
