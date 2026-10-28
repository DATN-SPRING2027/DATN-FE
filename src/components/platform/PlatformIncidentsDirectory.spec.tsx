import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import type { PlatformPermission } from "@/lib/queries/platform/usePlatformConsole";
import messages from "@/messages/en.json";
import { usePlatformOperationsViewModel } from "./usePlatformOperationsViewModel";
import PlatformIncidentsDirectory from "./PlatformIncidentsDirectory";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));
const mockApi = vi.mocked(apiClient);
const page = {
  data: [],
  pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
};
const created = {
  id: "651a2b3c4d5e6f7a8b9c0d21",
  title: "Queue incident",
  severity: "CRITICAL",
  status: "OPEN",
  affectedServiceId: "jira",
  version: 1,
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  createdBy: "651a2b3c4d5e6f7a8b9c0d1e",
  updatedBy: "651a2b3c4d5e6f7a8b9c0d1e",
  acknowledgedAt: null,
  resolvedAt: null,
};
let showModal: PropertyDescriptor | undefined;
beforeEach(() => {
  mockApi.mockReset().mockResolvedValue(page);
  vi.spyOn(document, "cookie", "get").mockReturnValue(
    "__Host-csrf=csrf-test-token",
  );
  showModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (showModal)
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});
function Content({ manage }: { manage: boolean }) {
  const permissions: PlatformPermission[] = [
    "platform.incidents.incident.read",
  ];
  if (manage) permissions.push("platform.incidents.incident.manage");
  const model = usePlatformOperationsViewModel({
    section: "incidents",
    permissions,
    operatorId: created.createdBy,
  });
  return <PlatformIncidentsDirectory model={model} />;
}
function setup(manage = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Content manage={manage} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
function openAndFill() {
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  const dialog = screen.getByRole("dialog", { name: "Create incident" });
  expect(within(dialog).getByLabelText("Title")).toHaveFocus();
  fireEvent.change(within(dialog).getByLabelText("Title"), {
    target: { value: "Queue incident" },
  });
  fireEvent.change(within(dialog).getByLabelText("Severity"), {
    target: { value: "CRITICAL" },
  });
  fireEvent.change(within(dialog).getByLabelText("Affected service"), {
    target: { value: "jira" },
  });
  return dialog;
}
it("creates through the existing contract and closes only after server confirmation", async () => {
  let confirm: ((value: typeof created) => void) | undefined;
  mockApi.mockImplementation(async (_path, options) =>
    options?.method === "POST"
      ? await new Promise<typeof created>((resolve) => {
          confirm = resolve;
        })
      : page,
  );
  setup();
  const dialog = openAndFill();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Create incident",
    }),
  );
  await waitFor(() =>
    expect(mockApi).toHaveBeenCalledWith(
      "/iam/platform/incidents",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Queue incident",
          severity: "CRITICAL",
          affectedServiceId: "jira",
        }),
      }),
    ),
  );
  expect(dialog).toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Creating…" }),
    ).toBeDisabled(),
  );
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(dialog).toBeInTheDocument();
  confirm?.(created);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Incident created.");
});
it("keeps entered values in the modal when creation fails", async () => {
  mockApi.mockImplementation(async (_path, options) => {
    if (options?.method === "POST")
      throw new ApiError(503, "UNAVAILABLE", "private service failure");
    return page;
  });
  setup();
  const dialog = openAndFill();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Create incident",
    }),
  );
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    ),
  );
  expect(within(dialog).getByLabelText("Title")).toHaveValue("Queue incident");
  expect(
    within(dialog).queryByText("private service failure"),
  ).not.toBeInTheDocument();
});
it("keeps incident creation unavailable without the management permission", () => {
  setup(false);
  const create = screen.getByRole("button", { name: "Create" });
  expect(create).toBeDisabled();
  fireEvent.click(create);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    mockApi.mock.calls.some(([, options]) => options?.method === "POST"),
  ).toBe(false);
});
