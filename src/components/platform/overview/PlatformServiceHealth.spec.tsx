import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformServiceHealth from "./PlatformServiceHealth";
const { query, useServices } = vi.hoisted(() => ({
  query: {
    data: [{ id: "iam", name: "IAM", status: "READY" }],
    isError: false,
    refetch: vi.fn(),
  },
  useServices: vi.fn(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/queries/platform/usePlatformOperations", () => ({
  usePlatformServicesQuery: (enabled: boolean) => {
    useServices(enabled);
    return query;
  },
}));
const health = {
  status: "UNKNOWN",
  total: null,
  ready: null,
  degraded: null,
  unavailable: null,
  lastCheckedAt: null,
};
describe("Dashboard service evidence", () => {
  beforeEach(() => {
    query.isError = false;
    vi.clearAllMocks();
  });
  it("hides cached service names and status when service permission is absent", () => {
    render(<PlatformServiceHealth health={health} permissions={[]} />);
    expect(useServices).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("IAM")).not.toBeInTheDocument();
    expect(screen.getAllByText("dashboard.unavailable")).toHaveLength(4);
  });
  it("shows reported service readiness only when authorized", () => {
    render(
      <PlatformServiceHealth
        health={health}
        permissions={["platform.services.service.read"]}
      />,
    );
    expect(useServices).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("IAM")).toBeInTheDocument();
    expect(screen.getByText("jira.ready")).toBeInTheDocument();
  });
  it("hides stale readiness on service-list failure and allows retry", () => {
    query.isError = true;
    render(
      <PlatformServiceHealth
        health={health}
        permissions={["platform.services.service.read"]}
      />,
    );
    expect(screen.queryByText("IAM")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("jira.servicesError");
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(query.refetch).toHaveBeenCalledOnce();
  });
});
