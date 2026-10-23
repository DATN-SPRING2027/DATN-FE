import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformDashboard from "./PlatformDashboard";
const { query, useDashboard } = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  useDashboard: vi.fn(),
}));
vi.mock("./overview/OperatorReferenceChart", () => ({
  default: ({ title }: { title?: string }) => <div>{title}</div>,
}));
vi.mock("@/lib/queries/platform/usePlatformOperations", () => ({
  usePlatformServicesQuery: () => ({ data: [], isError: false }),
  usePlatformDashboardQuery: (enabled: boolean) => {
    useDashboard(enabled);
    return query;
  },
}));
vi.mock("./overview/OverviewOrganizations", () => ({ default: () => null }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
const permissions = ["platform.dashboard.summary.read"] as const;
const data = () => ({
  organizations: { total: 23 },
  users: { total: 45, active: 42, suspended: 3, pendingInvite: 0 },
  projects: { total: 11, active: 10, archived: 1 },
  memberships: {
    total: 72,
    active: 68,
    suspended: 2,
    pendingInvite: 1,
    removed: 1,
  },
  generatedAt: "2026-10-21T00:00:00.000Z",
  serviceHealth: {
    status: "UNKNOWN",
    total: null,
    ready: null,
    degraded: null,
    unavailable: null,
    lastCheckedAt: null,
  },
  recentOperationalActivity: { availability: "UNAVAILABLE", items: [] },
});
describe("Platform overview", () => {
  beforeEach(() => {
    query.data = data();
    query.isError = false;
    query.isPending = false;
    query.isFetching = false;
    vi.clearAllMocks();
  });
  it("never exposes cached metrics when dashboard permission is absent", () => {
    render(<PlatformDashboard permissions={[]} />);
    expect(useDashboard).toHaveBeenCalledWith(false);
    expect(screen.queryByText("23")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "dashboard.permissionNeeded",
    );
  });
  it("shows the live totals for organizations, users, projects and memberships", () => {
    render(<PlatformDashboard permissions={permissions} />);
    const summary = screen.getByRole("region", { name: "dashboard.summary" });
    expect(within(summary).getByText("dashboard.organizations")).toBeInTheDocument();
    expect(within(summary).getByText("dashboard.users")).toBeInTheDocument();
    expect(within(summary).getByText("dashboard.projects")).toBeInTheDocument();
    expect(within(summary).getByText("dashboard.memberships")).toBeInTheDocument();
    for (const total of ["23", "45", "11", "72"])
      expect(within(summary).getByText(total)).toBeInTheDocument();
  });
  it("renders unknown service health and unavailable audit as unavailable", () => {
    render(<PlatformDashboard permissions={permissions} />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getAllByText("dashboard.unavailable")).toHaveLength(4);
    expect(screen.getByText("dashboard.auditError")).toBeInTheDocument();
    expect(
      screen.queryByText("dashboard.noRecentActivity"),
    ).not.toBeInTheDocument();
  });
  it("hides cached aggregates on failure and offers retry", () => {
    query.isError = true;
    render(<PlatformDashboard permissions={permissions} />);
    expect(screen.queryByText("23")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(query.refetch).toHaveBeenCalledOnce();
  });
  it("does not turn pending metrics into zero", () => {
    query.isPending = true;
    query.data = undefined;
    render(<PlatformDashboard permissions={permissions} />);
    expect(
      screen.getByRole("region", { name: "dashboard.loading" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("keeps real totals separate from explicitly labelled reference charts", () => {
    const { rerender } = render(
      <PlatformDashboard permissions={permissions} />,
    );
    const snapshot = () =>
      document.querySelector<HTMLElement>(
        'dl[aria-label="liveDashboard.snapshot"]',
      )!;
    expect(within(snapshot()).getByText("72")).toBeInTheDocument();
    expect(
      screen.getAllByText("liveDashboard.simulated").length,
    ).toBeGreaterThan(0);
    const next = data();
    next.memberships.total = 17;
    query.data = next;
    rerender(<PlatformDashboard permissions={permissions} />);
    expect(within(snapshot()).getByText("17")).toBeInTheDocument();
    expect(within(snapshot()).queryByText("72")).not.toBeInTheDocument();
    for (const label of [
      "Deliveries",
      "Revenue and costs",
      "Invoices",
      "95.1%",
      "$169K",
      "BlueHorizon Ltd.",
    ])
      expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});
