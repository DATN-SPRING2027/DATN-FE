import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrganizationDetail from "./OrganizationDetail";
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
const record = {
  id: "org-1",
  name: "Example",
  slug: "example",
  plan: "FREE" as const,
  createdAt: "2026-10-21T00:00:00Z",
  updatedAt: "2026-10-21T00:00:00Z",
};
const query = {
  data: record,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};
afterEach(() => {
  window.location.hash = "";
});
describe("Organization edit deep link", () => {
  it("opens edit with authoritative detail after loading finishes", () => {
    window.location.hash = "edit";
    const onEdit = vi.fn();
    const { rerender } = render(
      <OrganizationDetail
        organization={{ ...query, isFetching: true }}
        organizationId="org-1"
        canManage
        onEdit={onEdit}
      />,
    );
    expect(onEdit).not.toHaveBeenCalled();
    rerender(
      <OrganizationDetail
        organization={query}
        organizationId="org-1"
        canManage
        onEdit={onEdit}
      />,
    );
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(record);
    rerender(
      <OrganizationDetail
        organization={{ ...query, data: { ...record } }}
        organizationId="org-1"
        canManage
        onEdit={onEdit}
      />,
    );
    expect(onEdit).toHaveBeenCalledOnce();
  });
  it("does not open edit without manage permission", () => {
    window.location.hash = "edit";
    const onEdit = vi.fn();
    render(
      <OrganizationDetail
        organization={query}
        organizationId="org-1"
        canManage={false}
        onEdit={onEdit}
      />,
    );
    expect(onEdit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "organizations.edit" }),
    ).not.toBeInTheDocument();
  });
  it("does not edit cached details belonging to a different organization", () => {
    window.location.hash = "edit";
    const onEdit = vi.fn();
    render(
      <OrganizationDetail
        organization={query}
        organizationId="org-2"
        canManage
        onEdit={onEdit}
      />,
    );
    expect(onEdit).not.toHaveBeenCalled();
  });
});
