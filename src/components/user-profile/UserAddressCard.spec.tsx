import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import messages from "@/messages/en.json";
import UserAddressCard from "./UserAddressCard";

it("shows address and social-link empty states without template values", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UserAddressCard />
    </NextIntlClientProvider>,
  );

  expect(screen.getByText("Address details are not available for this account.")).toBeVisible();
  expect(screen.getByText("No social links have been provided.")).toBeVisible();
  expect(screen.queryByText(/Arizona|Phoenix|TAX ID|AS4568384|PimjoHQ/i)).toBeNull();
});
