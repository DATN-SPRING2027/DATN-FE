import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api-client";
import messages from "@/messages/en.json";
import type { PlatformAuditEvent } from "@/lib/queries/platform/usePlatformOperations";
import PlatformAuditProjection from "./PlatformAuditProjection";

const state = vi.hoisted(() => ({
  detail: {
    data: undefined as PlatformAuditEvent | undefined,
    error: undefined as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetchError: false,
    refetch: vi.fn(),
  },
  history: {
    data: { data: [] as PlatformAuditEvent[] },
    error: undefined as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetchError: false,
    refetch: vi.fn(),
  },
  historyQuery: vi.fn(),
  detailQuery: vi.fn(),
}));
const event: PlatformAuditEvent = {
  eventId: "audit-event-one",
  occurredAt: "2026-10-28T00:00:00.000Z",
  actorUserId: "651a2b3c4d5e6f7a8b9c0d1e",
  action: "organization.create",
  resourceType: "ORGANIZATION",
  resourceId: "651a2b3c4d5e6f7a8b9c0d21",
  scope: "PLATFORM",
  result: "SUCCESS",
  requestId: "request-one",
  changes: {
    name: { from: "Previous organization", to: "Updated organization" },
  },
};

vi.mock("@/lib/queries/platform/usePlatformOperations", () => ({
  platformAuditActions: ["organization.create"],
  usePlatformAuditEventsQuery: () => ({
    data: {
      data: [event],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  usePlatformAuditEventQuery: (...args: unknown[]) => {
    state.detailQuery(...args);
    return state.detail;
  },
  usePlatformAuditResourceHistoryQuery: (...args: unknown[]) => {
    state.historyQuery(...args);
    return state.history;
  },
}));

let originalShowModal: PropertyDescriptor | undefined;
beforeEach(() => {
  originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.assign(state.detail, {
    data: event,
    error: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetchError: false,
  });
  state.history.data = { data: [event] };
  state.historyQuery.mockClear();
  state.detailQuery.mockClear();
});
afterEach(() => {
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});
function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <PlatformAuditProjection permissions={["platform.audit.read"]} />
    </NextIntlClientProvider>,
  );
}

it("opens the selected audit event in a modal and returns focus when closed with Escape", async () => {
  setup();
  expect(
    screen.queryByRole("button", { name: "Refresh" }),
  ).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: event.action });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Audit detail" });
  expect(dialog).toHaveAttribute("open");
  expect(within(dialog).getByText("request-one")).toBeInTheDocument();
  expect(within(dialog).getByText("Previous organization")).toBeInTheDocument();
  expect(within(dialog).getByText("Updated organization")).toBeInTheDocument();
  expect(state.detailQuery).toHaveBeenCalledWith(event.eventId, true);
  expect(state.historyQuery).toHaveBeenCalledWith(
    event.resourceType,
    event.resourceId,
    true,
  );
  expect(
    within(dialog).getByRole("button", { name: "Close audit details" }),
  ).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("hides cached detail and history when access is denied, keeping the modal closable", () => {
  state.detail.isError = true;
  state.detail.error = new ApiError(
    403,
    "FORBIDDEN",
    "sensitive server detail",
  );
  setup();
  fireEvent.click(screen.getByRole("button", { name: event.action }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "Audit event details are unavailable.",
  );
  expect(within(dialog).queryByText("request-one")).not.toBeInTheDocument();
  expect(
    within(dialog).queryByText("Resource history"),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).queryByText("sensitive server detail"),
  ).not.toBeInTheDocument();
  expect(state.historyQuery).toHaveBeenLastCalledWith("", "", false);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Close audit details" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not show a cached event belonging to another selection", () => {
  state.detail.data = { ...event, eventId: "different-event" };
  setup();
  fireEvent.click(screen.getByRole("button", { name: event.action }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("status")).toHaveTextContent(
    "Loading Platform data",
  );
  expect(within(dialog).queryByText("request-one")).not.toBeInTheDocument();
  expect(state.historyQuery).toHaveBeenLastCalledWith("", "", false);
  fireEvent.click(dialog, { clientX: -1, clientY: -1 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
