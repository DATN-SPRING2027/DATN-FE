"use client";

import { useState, type FormEvent } from "react";
import { CloseLineIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import type { WorkItem } from "./work-types";

type ChatMessage = Readonly<{
  id: string;
  sender: "assistant" | "user";
  text: string;
}>;

export default function WorkAiCopilotDialog({
  isOpen,
  projectName,
  items,
  onClose,
}: {
  isOpen: boolean;
  projectName: string;
  items: readonly WorkItem[];
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello! I am the Continuum AI Copilot for ${projectName || "this workspace"}. I can summarize sprint progress, review SAG backend dependencies, or highlight high-priority tasks. What would you like to explore?`,
    },
  ]);

  function generateReply(query: string): string {
    const lower = query.toLowerCase();
    const total = items.length;
    const done = items.filter((item) => item.status === "DONE").length;
    const inProg = items.filter(
      (item) => item.status === "IN_PROGRESS",
    ).length;
    const todo = items.filter((item) => item.status === "TODO").length;
    const high = items.filter((item) => item.priority === "HIGH").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    if (
      lower.includes("progress") ||
      lower.includes("sprint") ||
      lower.includes("status")
    ) {
      return `Sprint Progress Summary: Tracking ${total} work items in ${projectName || "this space"}. Breakdown: ${done} Done (${pct}%), ${inProg} In Progress, and ${todo} To Do.`;
    }
    if (
      lower.includes("blocker") ||
      lower.includes("sag") ||
      lower.includes("dependency")
    ) {
      return `Blockers & Dependencies Analysis: Work item KNW-142 (SAG Retrieval citation review) and CSP-87 are currently In Progress with ${high} high-priority items across the board. Ensure ACL validation filters pass before closing the sprint.`;
    }
    return `Continuum AI Copilot: Analyzed "${query}" against ${total} workspace items (${high} High priority, ${done} Completed). Explore the Timeline or Reports tabs for deeper delivery metrics.`;
  }

  function submitQuestion(queryText: string) {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    const replyText = generateReply(trimmed);
    setMessages((current) => [
      ...current,
      {
        id: `user-${current.length + 1}`,
        sender: "user",
        text: trimmed,
      },
      {
        id: `ai-${current.length + 2}`,
        sender: "assistant",
        text: replyText,
      },
    ]);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25"
      showCloseButton={false}
      className="mx-4 max-w-xl p-0 shadow-theme-lg"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-ai-copilot-title"
        className="overflow-hidden rounded-2xl bg-white dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-base">
              ✨
            </span>
            <h2
              id="work-ai-copilot-title"
              className="text-sm font-semibold text-gray-900 dark:text-white/90"
            >
              Continuum AI Copilot (Sprint & Task Assistant)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Copilot"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <CloseLineIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              "Sprint progress report",
              "Blockers & SAG dependencies",
              "High priority items",
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => submitQuestion(chip)}
                className="cursor-pointer rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3.5 py-2.5 text-xs leading-5 ${
                msg.sender === "user"
                  ? "ms-10 bg-brand-500 text-white"
                  : "me-6 border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-gray-100 px-5 py-3.5 dark:border-gray-800"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask AI about sprint progress, blockers, or architecture…"
            className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <button
            type="submit"
            className="h-9 cursor-pointer rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
          >
            Send
          </button>
        </form>
      </div>
    </Modal>
  );
}
