import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider, useLocale, useTranslations } from "next-intl";
import PlatformCopyProvider from "./PlatformCopyProvider";
import enMessages from "@/messages/en.json";
import viMessages from "@/messages/vi.json";
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
  it("uses English UI copy when locale is 'en' without changing technical role mappings", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
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
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("status")).toHaveTextContent("en");
  });

  it("uses Vietnamese UI copy when locale is 'vi' while preserving technical role codes", () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages} timeZone="UTC">
        <PlatformCopyProvider>
          <Content />
        </PlatformCopyProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("vi");
    expect(
      screen.getByText(viMessages.platformConsole.navigation.dashboard),
    ).toBeInTheDocument();
    expect(
      screen.getByText(viMessages.platformConsole.navigation.organizations),
    ).toBeInTheDocument();
    expect(
      screen.getByText(viMessages.roleLabels.platformOperator),
    ).toBeInTheDocument();
    expect(
      screen.getByText(viMessages.roleLabels.organizationAdmin),
    ).toBeInTheDocument();
  });
});
