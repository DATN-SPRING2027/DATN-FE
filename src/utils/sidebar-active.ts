export function isSidebarPathActive(path: string, pathname: string): boolean {
  return (
    path === pathname ||
    ((path === "/projects" || path === "/workspace" || path === "/knowledge") &&
      pathname.startsWith(`${path}/`))
  );
}
