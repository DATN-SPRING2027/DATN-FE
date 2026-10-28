import { describe, expect, it } from "vitest";
import {
  resolveSessionCitationPreview,
  tokenizeTextWithCitations,
} from "./citation-utils";

describe("tokenizeTextWithCitations", () => {
  it("parses single and compound document & session citations [1], [1, 2], [S1, S2], [1, S1]", () => {
    const tokens = tokenizeTextWithCitations(
      "Quyết định dùng PostgreSQL [1, 2] đã chốt ở phiên trước [S1, S2] và đối chiếu tại [1, S1].",
    );

    const refs = tokens.filter((t) => t.kind !== "text");
    expect(refs).toEqual([
      {
        kind: "citations",
        items: [
          { type: "document", number: 1, label: "1" },
          { type: "document", number: 2, label: "2" },
        ],
      },
      {
        kind: "citations",
        items: [
          { type: "session", ref: "S1", label: "S1" },
          { type: "session", ref: "S2", label: "S2" },
        ],
      },
      {
        kind: "citations",
        items: [
          { type: "document", number: 1, label: "1" },
          { type: "session", ref: "S1", label: "S1" },
        ],
      },
    ]);
  });

  it("ignores bracket patterns inside inline backticks", () => {
    const tokens = tokenizeTextWithCitations(
      "Biến `items[1]` là code, còn bằng chứng nằm ở [1] và `[S1]` không phải link.",
    );
    const citationGroups = tokens.filter((t) => t.kind === "citations");
    expect(citationGroups).toEqual([
      {
        kind: "citations",
        items: [{ type: "document", number: 1, label: "1" }],
      },
    ]);
  });

  it("preserves Markdown links [1](url) and [S1](url) as text while enriching synthetic session excerpts from transcript", () => {
    const tokens = tokenizeTextWithCitations(
      "Xem tài liệu [1](https://continuum.ai/spec) và [S1](https://continuum.ai/session), đối chiếu [2、S2].",
    );
    const citationGroups = tokens.filter((t) => t.kind === "citations");
    expect(citationGroups).toEqual([
      {
        kind: "citations",
        items: [
          { type: "document", number: 2, label: "2" },
          { type: "session", ref: "S2", label: "S2" },
        ],
      },
    ]);

    const messagesById = new Map([
      ["m-u2", { content: "Chốt dùng PostgreSQL + Qdrant cho SAG." }],
    ]);
    expect(
      resolveSessionCitationPreview(
        {
          turnIds: ["m-u2", "m-u1"],
          summaryExcerpt: "Turns #1–#2 · CONFIRMED",
        },
        messagesById,
      ),
    ).toBe("Turns #1–#2 · CONFIRMED — Chốt dùng PostgreSQL + Qdrant cho SAG.");
  });
});
