export interface GoogleOrganizationOption {
  id: string;
  name: string;
}

export function parseGoogleOrganizationOptions(
  encoded: string | string[] | undefined,
): GoogleOrganizationOption[] | null {
  if (
    typeof encoded !== "string" ||
    encoded.length === 0 ||
    encoded.length > 6000 ||
    !/^[A-Za-z\d_-]+$/.test(encoded)
  ) {
    return null;
  }

  try {
    const options: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (!Array.isArray(options) || options.length < 2 || options.length > 50) {
      return null;
    }
    const parsed = options.filter(
      (option): option is GoogleOrganizationOption =>
        typeof option === "object" &&
        option !== null &&
        "id" in option &&
        typeof option.id === "string" &&
        /^[a-f\d]{24}$/i.test(option.id) &&
        "name" in option &&
        typeof option.name === "string" &&
        option.name.length > 0 &&
        option.name.length <= 120,
    );
    if (
      parsed.length !== options.length ||
      new Set(parsed.map(({ id }) => id)).size !== parsed.length
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
