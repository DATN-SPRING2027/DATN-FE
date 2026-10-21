import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrganizationDirectory from "./OrganizationDirectory";
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const row = {
  id: "org-1",
  name: "Example",
  slug: "example",
  plan: "FREE" as const,
  createdAt: "2026-10-21T00:00:00Z",
  updatedAt: "2026-10-21T00:00:00Z",
};
describe("Organization plan percentages", () => {
  it("computes plan percentages from the bounded page, not the global total", () => {
    render(
      <OrganizationDirectory
        setOrganizationPage={vi.fn()}
        organizations={{
          isPending: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            data: [row, { ...row, id: "org-2", plan: "ENTERPRISE" }],
            pagination: {
              page: 1,
              pageSize: 2,
              totalItems: 100,
              totalPages: 50,
            },
          },
        }}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getAllByText("50%")).toHaveLength(2);
    expect(screen.getAllByTitle("organizations.planPercentNote")).toHaveLength(
      2,
    );
  });
  it("shows zero percentages for an empty directory", () => {
    render(
      <OrganizationDirectory
        setOrganizationPage={vi.fn()}
        organizations={{
          isPending: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            data: [],
            pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
          },
        }}
      />,
    );
    expect(screen.getAllByText("0%")).toHaveLength(3);
  });
});
