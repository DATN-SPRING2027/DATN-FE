import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider, useLocale, useTranslations } from "next-intl";
import PlatformCopyProvider from "./PlatformCopyProvider";
import messages from "@/messages/en.json";
import RoleLabel from "@/components/common/RoleLabel";
function Content() {
  const t = useTranslations("platformConsole.navigation");
  return (
    <>
      <p>{t("dashboard")}</p>
      <p>{t("organizations")}</p>
      <p>{t("users")}</p>
      <output>{useLocale()}</output>
      <RoleLabel roleCode="PLATFORM_OPERATOR" />
      <RoleLabel roleCode="ADMIN" />
    </>
  );
}
describe("Platform reference copy", () => {
  it("uses English UI copy without changing routing locale or technical role mappings", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <PlatformCopyProvider>
          <Content />
        </PlatformCopyProvider>
      </NextIntlClientProvider>,
    );
    for (const label of [
      "Dashboard",
      "Organizations",
      "Users",
      "Admin",
      "Manager",
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("en");
  });
});
