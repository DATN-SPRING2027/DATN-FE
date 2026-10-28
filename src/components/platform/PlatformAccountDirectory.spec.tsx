import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import PlatformAccountDirectory from "./PlatformAccountDirectory";
it("shows identity without backend permissions, activity controls or session navigation", () => {
  const account = {
    id: "651a2b3c4d5e6f7a8b9c0d1e",
    name: "Platform Operator",
    email: "operator@example.test",
    context: "PLATFORM",
    permissions: ["platform.audit.read", "platform.sessions.session.read"],
  };
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <PlatformAccountDirectory account={account} />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByRole("heading", { name: account.name }),
  ).toBeInTheDocument();
  expect(screen.getByText(account.email)).toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "View sessions" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Effective permission count"),
  ).not.toBeInTheDocument();
  for (const permission of account.permissions)
    expect(screen.queryByText(permission)).not.toBeInTheDocument();
});
