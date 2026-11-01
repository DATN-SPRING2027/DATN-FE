import fs from "node:fs";
import path from "node:path";
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

function hasPath(obj: unknown, dotPath: string): boolean {
  return (
    dotPath
      .split(".")
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === "object"
            ? (acc as Record<string, unknown>)[part]
            : undefined,
        obj,
      ) !== undefined
  );
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.spec\.(ts|tsx)$/.test(entry.name)
    ) {
      out.push(full);
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
    expect(tHandover("list.loadingTitle")).toBe(
      viMessages.handover.list.loadingTitle,
    );
    expect(tHandover("detail.loadingTitle")).toBe(
      viMessages.handover.detail.loadingTitle,
    );
  });

  it("resolves every static useTranslations and getTranslations key referenced across src", () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const unresolved: string[] = [];
    const bindRe =
      /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{\s*[^}]*namespace:\s*["']([^"']+)["'][^}]*\}|["']([^"']+)["'])\s*\)/g;

    for (const file of walkSourceFiles(srcRoot)) {
      const content = fs.readFileSync(file, "utf8");
      const bindings: Array<{ index: number; varName: string; ns: string }> =
        [];
      let m: RegExpExecArray | null;
      while ((m = bindRe.exec(content)) !== null) {
        bindings.push({
          index: m.index,
          varName: m[1],
          ns: m[2] || m[3],
        });
      }
      if (bindings.length === 0) continue;

      const varNames = [...new Set(bindings.map((b) => b.varName))];
      for (const varName of varNames) {
        const callRe = new RegExp(
          `(?<![.\\w])${varName}\\(\\s*["']([a-zA-Z0-9_.-]+)["']`,
          "g",
        );
        let cm: RegExpExecArray | null;
        while ((cm = callRe.exec(content)) !== null) {
          const callIndex = cm.index;
          const preceding = bindings.filter(
            (b) => b.varName === varName && b.index < callIndex,
          );
          const active =
            preceding[preceding.length - 1] ??
            bindings.find((b) => b.varName === varName);
          if (!active) continue;

          const fullKey = `${active.ns}.${cm[1]}`;
          if (!hasPath(enMessages, fullKey) || !hasPath(viMessages, fullKey)) {
            const relFile = path.relative(srcRoot, file).replace(/\\/g, "/");
            unresolved.push(`${relFile} -> ${fullKey}`);
          }
        }
      }
    }

    expect(unresolved).toEqual([]);
  });
});
