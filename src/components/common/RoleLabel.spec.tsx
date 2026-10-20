import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import messages from "@/messages/en.json";
import RoleLabel from "./RoleLabel";

it.each([
  ["PLATFORM_OPERATOR", "Admin"],
  ["ADMIN", "Manager"],
  ["TEAM_LEADER", "Project Leader"],
  ["MEMBER", "Member"],
] as const)("renders %s with its business display label", (roleCode, label) => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleLabel roleCode={roleCode} />
    </NextIntlClientProvider>,
  );

  expect(screen.getByText(label)).toBeVisible();
});
