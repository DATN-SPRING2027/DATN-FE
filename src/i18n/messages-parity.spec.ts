import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import { routing } from "./routing";
import { languages } from "./languages";

type JsonNode =
  | string
  | number
  | boolean
  | null
  | JsonNode[]
  | { [key: string]: JsonNode };

function collectLeaves(
  node: JsonNode,
  prefix = "",
  out = new Map<string, string>(),
): Map<string, string> {
  if (typeof node === "string") {
    out.set(prefix, node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child, idx) =>
      collectLeaves(child, `${prefix}[${idx}]`, out),
    );
    return out;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      collectLeaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function extractIcuVars(message: string): string[] {
  const vars = new Set<string>();
  let depth = 0;
  let tokenStart = -1;
  for (let i = 0; i < message.length; i += 1) {
    const ch = message[i];
    if (ch === "'" && message[i + 1] === "{") {
      i += 1;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) tokenStart = i + 1;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && tokenStart !== -1) {
        const inner = message.slice(tokenStart, i).trim();
        const varName = inner.split(",")[0]?.trim();
        if (varName && /^[A-Za-z0-9_]+$/.test(varName)) {
          vars.add(varName);
        }
        tokenStart = -1;
      }
    }
  }
  return [...vars].sort();
}

describe("English (en) and Vietnamese (vi) i18n message parity", () => {
  it("registers both 'en' and 'vi' in routing and Language Switcher options", () => {
    expect(routing.locales).toEqual(["en", "vi"]);
    expect(languages.map((lang) => lang.id)).toEqual(["en", "vi"]);
    expect(languages.find((lang) => lang.id === "vi")?.name).toBe("Tiếng Việt");
  });

  it("maintains 100% identical key paths across all namespaces in en.json and vi.json", () => {
    const enLeaves = collectLeaves(enMessages as unknown as JsonNode);
    const viLeaves = collectLeaves(viMessages as unknown as JsonNode);

    const missingInVi = [...enLeaves.keys()].filter((k) => !viLeaves.has(k));
    const extraInVi = [...viLeaves.keys()].filter((k) => !enLeaves.has(k));

    expect(missingInVi).toEqual([]);
    expect(extraInVi).toEqual([]);
    expect(viLeaves.size).toBeGreaterThan(4300);
  });

  it("preserves identical ICU placeholder variables and balanced braces on every leaf string", () => {
    const enLeaves = collectLeaves(enMessages as unknown as JsonNode);
    const viLeaves = collectLeaves(viMessages as unknown as JsonNode);
    const mismatches: string[] = [];

    for (const [key, enVal] of enLeaves.entries()) {
      const viVal = viLeaves.get(key) ?? "";
      const openCount = (viVal.match(/\{/g) ?? []).length;
      const closeCount = (viVal.match(/\}/g) ?? []).length;
      if (openCount !== closeCount) {
        mismatches.push(`${key}: unbalanced braces in vi "${viVal}"`);
        continue;
      }
      const enVars = extractIcuVars(enVal);
      const viVars = extractIcuVars(viVal);
      if (enVars.join(",") !== viVars.join(",")) {
        mismatches.push(
          `${key}: en vars [${enVars.join(",")}] != vi vars [${viVars.join(",")}]`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("sets localeCode and localized Vietnamese role display labels accurately", () => {
    expect(enMessages.common.localeCode).toBe("en");
    expect(viMessages.common.localeCode).toBe("vi");

    expect(viMessages.roleLabels.platformOperator).toBe("Quản trị hệ thống");
    expect(viMessages.roleLabels.organizationAdmin).toBe("Quản lý");
    expect(viMessages.roleLabels.teamLeader).toBe("Trưởng nhóm");
    expect(viMessages.roleLabels.teamLeaders).toBe("Trưởng nhóm");
    expect(viMessages.roleLabels.member).toBe("Thành viên");

    const tHandover = createTranslator({
      locale: "vi",
      messages: viMessages,
      namespace: "handover",
    });
    expect(tHandover("createCta")).toBe(viMessages.handover.createCta);
  });
});
