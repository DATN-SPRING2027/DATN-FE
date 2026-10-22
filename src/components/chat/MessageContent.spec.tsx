import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import MessageContent, { messageLinks } from "./MessageContent";

it("renders only HTTP(S) URLs as safe links and leaves markup as text", () => {
  render(
    <MessageContent
      content={
        "See https://example.test/docs?q=1. <img src=x onerror=alert(1)> javascript:alert(1)"
      }
    />,
  );
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(2);
  for (const link of links) {
    expect(link).toHaveAttribute("href", "https://example.test/docs?q=1");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(document.querySelector("img")).toBeNull();
  expect(messageLinks("https://user:secret@example.test")).toEqual([]);
});
