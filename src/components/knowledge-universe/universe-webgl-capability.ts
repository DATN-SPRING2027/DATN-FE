export type UniverseWebGLCapability = "available" | "api-unavailable";
export type UniverseSceneUnavailableReason =
  | "context-disabled"
  | "context-creation"
  | "context-lost";

interface UniverseWebGLScope {
  WebGL2RenderingContext?: unknown;
}

export function detectUniverseWebGLCapability(
  scope: UniverseWebGLScope | null | undefined,
): UniverseWebGLCapability {
  return typeof scope?.WebGL2RenderingContext === "function"
    ? "available"
    : "api-unavailable";
}
