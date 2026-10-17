import { describe, expect, it } from "vitest";
import messages from "./en.json";

const platformMessages = messages.platformConsole as unknown as Record<string, unknown>;

function getMessage(path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, platformMessages);
}

describe("Platform Console runtime messages", () => {
  it.each([
    "loadingOrganizations",
    "loadingMemberships",
    "lookingUp",
    "pages.services.permissionNeeded",
  ])("defines the message used by %s states", (path) => {
    expect(getMessage(path)).toEqual(expect.any(String));
  });
});
