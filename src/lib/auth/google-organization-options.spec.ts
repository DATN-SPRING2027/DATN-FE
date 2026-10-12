import { describe, expect, it } from "vitest";
import { parseGoogleOrganizationOptions } from "./google-organization-options";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("parseGoogleOrganizationOptions", () => {
  it("accepts distinct bounded organization options from the IAM conflict response", () => {
    expect(
      parseGoogleOrganizationOptions(
        encode([
          { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
          { id: "651a2b3c4d5e6f7a8b9c0d20", name: "Beta" },
        ]),
      ),
    ).toEqual([
      { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
      { id: "651a2b3c4d5e6f7a8b9c0d20", name: "Beta" },
    ]);
  });

  it.each([
    undefined,
    ["one", "two"],
    "not-base64!",
    encode([
      { id: "bad-id", name: "Alpha" },
      { id: "another-bad-id", name: "Beta" },
    ]),
    encode([
      { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Alpha" },
      { id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Duplicate" },
    ]),
    encode([{ id: "651a2b3c4d5e6f7a8b9c0d1f", name: "Only one" }]),
  ])("rejects malformed or ambiguous option payloads", (value) => {
    expect(parseGoogleOrganizationOptions(value)).toBeNull();
  });
});
