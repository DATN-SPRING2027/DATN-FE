// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forwardBackendRequest } from "./forward";

describe("BFF file downloads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves the attachment filename and PDF bytes from the backend", async () => {
    const disposition = "attachment; filename*=UTF-8''project-design.pdf";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF-1.4", {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": disposition,
        "cache-control": "no-store",
      },
    })));
    const response = await forwardBackendRequest(
      new NextRequest("http://localhost:3000/api/backend/capture/projects/project/documents/document/file"),
      ["capture", "projects", "project", "documents", "document", "file"],
    );

    expect(response.headers.get("content-disposition")).toBe(disposition);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.text()).toBe("%PDF-1.4");
  });
});
