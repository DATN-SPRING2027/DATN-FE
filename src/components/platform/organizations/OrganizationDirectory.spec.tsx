import { fireEvent, render, screen, within } from "@testing-library/react";
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
describe("Organization directory filters", () => {
  it("filters the bounded page by plan without inventing global breakdowns", () => {
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
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      3,
    );
    fireEvent.click(screen.getByRole("button", { name: "FREE" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    expect(screen.getByRole("button", { name: "FREE" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "not-found" },
    });
    expect(screen.getByText("organizations.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("organizations.noMatches")).toBeInTheDocument();
  });
  it("shows an empty state without fabricated zero percentage metrics", () => {
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
    expect(screen.getByText("organizations.emptyTitle")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
  it("sorts the current page by name, slug and newest creation without mutating the response", () => {
    const rows = [
      {
        ...row,
        id: "org-z",
        name: "Zulu",
        slug: "alpha",
        createdAt: "2026-10-23T00:00:00Z",
      },
      { ...row, id: "org-a", name: "Alpha", slug: "zulu" },
    ];
    render(
      <OrganizationDirectory
        setOrganizationPage={vi.fn()}
        organizations={{
          isPending: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            data: rows,
            pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
          },
        }}
      />,
    );
    const firstName = () =>
      within(screen.getByRole("table")).getAllByRole("link")[0].textContent;
    expect(firstName()).toBe("Alpha");
    fireEvent.change(screen.getByLabelText("organizations.sortBy"), {
      target: { value: "slug" },
    });
    expect(firstName()).toBe("Zulu");
    fireEvent.change(screen.getByLabelText("organizations.sortBy"), {
      target: { value: "created" },
    });
    expect(firstName()).toBe("Zulu");
    expect(rows[0].name).toBe("Zulu");
  });
});
