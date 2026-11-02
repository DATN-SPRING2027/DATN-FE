import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
import {
  formatAiChatTitle,
  formatAppTitle,
  formatPlatformTitle,
  formatProjectOverviewTitle,
  formatProjectSectionTitle,
  truncateTitleSegment,
} from "./page-titles";

function walkLocaleRoutes(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkLocaleRoutes(fullPath, out);
    } else if (entry.name === "page.tsx") {
      out.push(fullPath);
    }
  }
  return out;
}

function TitleProbe({ title }: { title: string | null | undefined }) {
  useDocumentTitle(title);
  return null;
}

describe("Page tab title formatting & full-route coverage", () => {
  it("formats standard app pages with compact Continuum suffix", () => {
    expect(formatAppTitle("Tổng quan tổ chức")).toBe(
      "Tổng quan tổ chức · Continuum",
    );
    expect(formatAppTitle("  Sign In  ")).toBe("Sign In · Continuum");
    expect(formatAppTitle("")).toBe("Continuum");
  });

  it("formats project overview and Option B project-first section titles", () => {
    expect(formatProjectOverviewTitle("Hệ thống ERP", "Tổng quan dự án")).toBe(
      "Hệ thống ERP · Continuum",
    );
    expect(formatProjectOverviewTitle(null, "Tổng quan dự án")).toBe(
      "Tổng quan dự án · Continuum",
    );

    expect(formatProjectSectionTitle("Hệ thống ERP", "Công việc")).toBe(
      "Hệ thống ERP · Công việc — Continuum",
    );
    expect(formatProjectSectionTitle("ERP Logistics", "Work")).toBe(
      "ERP Logistics · Work — Continuum",
    );
    expect(formatProjectSectionTitle(undefined, "Công việc")).toBe(
      "Công việc · Continuum",
    );
  });

  it("formats AI Chat titles with Continuum AI branding and streaming indicator", () => {
    expect(formatAiChatTitle({ fallbackLabel: "AI Chat" })).toBe(
      "AI Chat · Continuum AI",
    );
    expect(
      formatAiChatTitle({
        threadTitle: "Kiến trúc phân quyền RBAC",
        fallbackLabel: "AI Chat",
      }),
    ).toBe("Kiến trúc phân quyền RBAC · Continuum AI");
    expect(
      formatAiChatTitle({
        threadTitle: "Kiến trúc phân quyền RBAC",
        fallbackLabel: "AI Chat",
        isStreaming: true,
      }),
    ).toBe("● Kiến trúc phân quyền RBAC · Continuum AI");
  });

  it("formats Platform Console titles and truncates long entity labels cleanly", () => {
    expect(formatPlatformTitle("Vận hành AI")).toBe(
      "Vận hành AI · Continuum Platform",
    );
    const longLabel = "A".repeat(80);
    const truncated = truncateTitleSegment(longLabel, 24);
    expect(truncated).toHaveLength(24);
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("synchronizes document.title reactively on client updates and ignores null", () => {
    document.title = "Initial · Continuum";
    const { rerender } = render(
      <TitleProbe title="Công việc · Continuum" />,
    );
    expect(document.title).toBe("Công việc · Continuum");

    rerender(<TitleProbe title="Hệ thống ERP · Công việc — Continuum" />);
    expect(document.title).toBe("Hệ thống ERP · Công việc — Continuum");

    rerender(<TitleProbe title={null} />);
    expect(document.title).toBe("Hệ thống ERP · Công việc — Continuum");
  });

  it("enforces generateMetadata on every [locale] page.tsx and eliminates TailAdmin titles", () => {
    const localeRoot = path.resolve(process.cwd(), "src/app/[locale]");
    const pages = walkLocaleRoutes(localeRoot);
    expect(pages.length).toBeGreaterThanOrEqual(65);

    const missingMetadata: string[] = [];
    const leftoverTailAdmin: string[] = [];

    for (const pageFile of pages) {
      const content = fs.readFileSync(pageFile, "utf8");
      const rel = path.relative(localeRoot, pageFile).replace(/\\/g, "/");
      if (!/export\s+(async\s+)?function\s+generateMetadata\b/.test(content)) {
        missingMetadata.push(rel);
      }
      if (/TailAdmin/i.test(content)) {
        leftoverTailAdmin.push(rel);
      }
    }

    expect(missingMetadata).toEqual([]);
    expect(leftoverTailAdmin).toEqual([]);

    const rootLayout = fs.readFileSync(
      path.join(localeRoot, "layout.tsx"),
      "utf8",
    );
    expect(rootLayout).toMatch(/export\s+async\s+function\s+generateMetadata/);

    const notFoundPage = fs.readFileSync(
      path.join(localeRoot, "not-found.tsx"),
      "utf8",
    );
    expect(notFoundPage).not.toMatch(/TailAdmin/i);

    for (const [key, val] of Object.entries(viMessages.pageTitles)) {
      expect(val.trim().length, `vi.pageTitles.${key}`).toBeGreaterThan(0);
      expect(val).not.toMatch(/TailAdmin|localhost/i);
    }
    for (const [key, val] of Object.entries(enMessages.pageTitles)) {
      expect(val.trim().length, `en.pageTitles.${key}`).toBeGreaterThan(0);
      expect(val).not.toMatch(/TailAdmin|localhost/i);
    }
    expect(viMessages.legalCenter.termsMetaTitle).toBe(
      "Điều khoản sử dụng · Continuum",
    );
    expect(viMessages.legalCenter.privacyMetaTitle).toBe(
      "Chính sách bảo mật · Continuum",
    );
  });
});
