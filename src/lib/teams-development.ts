/** Release stays closed in production, regardless of this development opt-in. */
export function teamDevelopmentEnabled(): boolean {
  return (
    (process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test") &&
    process.env.TEAM_FOUNDATION_DEV_INTEGRATION === "true"
  );
}

/** Show the clearly labeled local fixture when development API wiring is off. */
export function teamFixturePreviewEnabled(requestedMode?: string): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (requestedMode === "fixture" ||
      (!teamDevelopmentEnabled() && requestedMode !== "api"))
  );
}

export function isTeamPath(path: readonly string[]): boolean {
  const lower = path.map((segment) => segment.toLowerCase());
  return (
    lower[0] === "iam" &&
    (lower[1] === "teams" || (lower[1] === "projects" && lower[3] === "teams"))
  );
}

export function allowedTeamMethod(
  path: readonly string[],
  method: string,
): boolean {
  if (
    path.length === 4 &&
    path[1] === "projects" &&
    path[2] &&
    path[3] === "teams"
  )
    return ["GET", "POST"].includes(method);
  if (path.length === 3 && path[1] === "teams" && path[2])
    return ["GET", "PATCH"].includes(method);
  return (
    path.length === 4 &&
    path[1] === "teams" &&
    !!path[2] &&
    ["archive", "restore"].includes(path[3]) &&
    method === "POST"
  );
}
