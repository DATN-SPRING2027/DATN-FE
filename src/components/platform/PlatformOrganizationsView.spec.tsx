import { ApiError } from "@/lib/api-client";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformOrganizationsView from "./PlatformOrganizationsView";
import type { PlatformOrganizationsViewProps } from "./organizations/types";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
const record = {
  id: "651a2b3c4d5e6f7a8b9c0d21",
  name: "North Star",
  slug: "north-star",
  plan: "FREE" as const,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};
function props(): PlatformOrganizationsViewProps {
  return {
    organizations: {
      data: {
        data: [record],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    },
    organization: {
      data: { ...record, name: "Fresh server name" },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    },
    canReadOrganizations: true,
    canManageOrganizations: false,
    canCreateOrganization: true,
    canLookupUsers: true,
    routeOrganizationId: "",
    hasValidRouteOrganizationId: false,
    selectedOrganizationId: "",
    setOrganizationPage: vi.fn(),
    organizationName: "New Org",
    setOrganizationName: vi.fn(),
    organizationSlug: "new-org",
    setOrganizationSlug: vi.fn(),
    organizationPlan: "FREE",
    setOrganizationPlan: vi.fn(),
    lookupEmail: "manager@example.test",
    setLookupEmail: vi.fn(),
    selectedUser: {
      id: record.id,
      email: "manager@example.test",
      fullName: "Manager",
    },
    setSelectedUser: vi.fn(),
    runLookup: vi.fn(),
    runCreateOrganization: vi.fn().mockResolvedValue(false),
    createOrganizationPending: false,
    lookupPending: false,
    changeOrganizationMetadata: { mutateAsync: vi.fn(), isPending: false },
    setOperationMessage: vi.fn(),
    isCreateModalOpen: false,
    setIsCreateModalOpen: vi.fn(),
  };
}
describe("Platform Organizations", () => {
  it("opens detail through a keyboard-accessible route", () => {
    render(<PlatformOrganizationsView {...props()} />);
    expect(screen.getByRole("link", { name: "North Star" })).toHaveAttribute(
      "href",
      `/platform/organizations/${record.id}`,
    );
  });
  it("uses the detail API projection even when the row cache differs", () => {
    render(
      <PlatformOrganizationsView
        {...props()}
        routeOrganizationId={record.id}
        hasValidRouteOrganizationId
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Fresh server name" }),
    ).toBeInTheDocument();
  });
  it("does not expose directory edit actions without manage permission", () => {
    render(<PlatformOrganizationsView {...props()} />);
    expect(
      screen.queryByTitle("Edit organization metadata"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "organizations.edit" }),
    ).not.toBeInTheDocument();
  });
  it("keeps the create form and input visible when creation fails", async () => {
    const p = props();
    render(<PlatformOrganizationsView {...p} isCreateModalOpen />);
    fireEvent.submit(
      screen.getByLabelText("organizations.name").closest("form")!,
    );
    await waitFor(() => expect(p.runCreateOrganization).toHaveBeenCalled());
    expect(p.setIsCreateModalOpen).not.toHaveBeenCalledWith(false);
  });
  it("hides cached organization metrics without read permission", () => {
    render(
      <PlatformOrganizationsView {...props()} canReadOrganizations={false} />,
    );
    expect(screen.queryByText("North Star")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
  it("closes creation only after the backend confirms success", async () => {
    const p = props();
    vi.mocked(p.runCreateOrganization).mockResolvedValue(true);
    render(<PlatformOrganizationsView {...p} isCreateModalOpen />);
    fireEvent.submit(
      screen.getByLabelText("organizations.name").closest("form")!,
    );
    await waitFor(() =>
      expect(p.setIsCreateModalOpen).toHaveBeenCalledWith(false),
    );
  });
  it("requires a lookup result matching the current email", () => {
    render(
      <PlatformOrganizationsView
        {...props()}
        isCreateModalOpen
        lookupEmail="other@example.test"
      />,
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "organizations.create",
      }),
    ).toBeDisabled();
  });
  it("reports lookup failure inside the dialog", async () => {
    const p = props();
    vi.mocked(p.runLookup).mockResolvedValue(false);
    render(<PlatformOrganizationsView {...p} isCreateModalOpen />);
    fireEvent.click(
      screen.getByRole("button", { name: "organizations.findFirstAdmin" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "errors.userLookup",
    );
  });
  it("sends metadata changes with the exact detail version and refreshes after success", async () => {
    const p = props();
    vi.mocked(p.changeOrganizationMetadata.mutateAsync).mockResolvedValue({});
    render(
      <PlatformOrganizationsView
        {...p}
        routeOrganizationId={record.id}
        hasValidRouteOrganizationId
        canManageOrganizations
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "organizations.edit" }));
    fireEvent.change(screen.getByLabelText("organizations.name"), {
      target: { value: "New Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "organizations.save" }));
    await waitFor(() =>
      expect(p.changeOrganizationMetadata.mutateAsync).toHaveBeenCalledWith({
        organizationId: record.id,
        name: "New Name",
        slug: record.slug,
        expectedUpdatedAt: record.updatedAt,
        reasonCode: "ACCESS_REVIEW",
      }),
    );
    await waitFor(() => expect(p.organization.refetch).toHaveBeenCalled());
  });
  it("preserves input on 409 and blocks replaying a stale metadata version", async () => {
    const p = props();
    vi.mocked(p.changeOrganizationMetadata.mutateAsync).mockRejectedValue(
      new ApiError(409, "CONFLICT", "Conflict"),
    );
    render(
      <PlatformOrganizationsView
        {...p}
        routeOrganizationId={record.id}
        hasValidRouteOrganizationId
        canManageOrganizations
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "organizations.edit" }));
    fireEvent.change(screen.getByLabelText("organizations.name"), {
      target: { value: "New Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "organizations.save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "errors.organizationConflict",
    );
    expect(screen.getByLabelText("organizations.name")).toHaveValue("New Name");
    expect(
      screen.getByRole("button", { name: "organizations.save" }),
    ).toBeDisabled();
    expect(p.changeOrganizationMetadata.mutateAsync).toHaveBeenCalledTimes(1);
  });
  it("keeps stale detail content and reports a failed background refresh", () => {
    const p = props();
    p.organization.isError = true;
    p.organization.isRefetchError = true;
    render(
      <PlatformOrganizationsView
        {...p}
        routeOrganizationId={record.id}
        hasValidRouteOrganizationId
      />,
    );
    expect(screen.getByText("Fresh server name")).toBeInTheDocument();
    expect(screen.getByText("updateFailed")).toBeInTheDocument();
  });
});
