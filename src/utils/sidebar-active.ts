export function isSidebarPathActive(path: string, pathname: string): boolean {
  return (
    path === pathname ||
    (path === "/projects" && pathname.startsWith(`${path}/`))
  );
}
