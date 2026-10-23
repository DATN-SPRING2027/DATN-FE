import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { vi, beforeEach, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { useProjectMemberCandidatesQuery } from "@/lib/queries/projects/useProjectMembers";
import MemberAddForm from "./MemberAddForm";

vi.mock("@/lib/queries/projects/useProjectMembers", () => ({
  useProjectMemberCandidatesQuery: vi.fn(),
}));
vi.mock("@/icons", () => ({ SearchIcon: () => null }));

const candidateQuery = vi.mocked(useProjectMemberCandidatesQuery);
const organizationId = "organization-000000000001";
const projectId = "123456789012345678901234";
const candidate = {
  userId: "223456789012345678901234",
  email: "candidate@example.test",
  fullName: "One Candidate",
  avatarUrl: null,
  organizationMembershipStatus: "ACTIVE",
  isProjectMember: false,
};

function mount(onAdd = vi.fn()) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );

  render(
    <MemberAddForm
      organizationId={organizationId}
      projectId={projectId}
      onAdd={onAdd}
      disabled={false}
      pending={false}
    />,
    { wrapper: Wrapper },
  );
  return { onAdd };
}

function search(email: string) {
  fireEvent.change(screen.getByLabelText(/Search by email/i), {
    target: { value: email },
  });
}

beforeEach(() => {
  candidateQuery.mockReset();
  candidateQuery.mockReturnValue({
    data: [],
    isFetching: false,
    isError: false,
  } as never);
});

it("lists active organization members immediately on open and allows selecting role when adding", async () => {
  candidateQuery.mockReturnValue({
    data: [candidate],
    isFetching: false,
    isError: false,
  } as never);
  const { onAdd } = mount();

  expect(await screen.findByText(candidate.fullName)).toBeVisible();
  expect(screen.getByText(candidate.email)).toBeVisible();

  const roleSelect = screen.getByRole("combobox", { name: "Role" });
  fireEvent.change(roleSelect, { target: { value: "TEAM_LEADER" } });

  fireEvent.click(screen.getByText(candidate.fullName));
  fireEvent.submit(screen.getByRole("form", { name: "Add member" }));

  expect(onAdd).toHaveBeenCalledWith(candidate.userId, "TEAM_LEADER");
});

it("requires explicit candidate selection even when the search returns one match", async () => {
  candidateQuery.mockReturnValue({
    data: [candidate],
    isFetching: false,
    isError: false,
  } as never);
  const { onAdd } = mount();

  search(candidate.email);
  expect(await screen.findByText(candidate.fullName)).toBeVisible();
  fireEvent.submit(screen.getByRole("form", { name: "Add member" }));

  expect(onAdd).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Select a candidate before adding a member.",
  );
});

it("does not submit the typed email as a user ID when no candidate matches", async () => {
  candidateQuery.mockReturnValue({
    data: [],
    isFetching: false,
    isError: false,
  } as never);
  const { onAdd } = mount();

  search("missing@example.test");
  expect(
    await screen.findByText("No active organization member found."),
  ).toBeVisible();
  fireEvent.submit(screen.getByRole("form", { name: "Add member" }));

  expect(onAdd).not.toHaveBeenCalled();
});

it("shows a search failure instead of presenting a permission error as an empty result", async () => {
  candidateQuery.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: true,
  } as never);
  mount();

  search("denied@example.test");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to search organization members. Check your access and try again.",
  );
  expect(
    screen.queryByText("No active organization member found."),
  ).not.toBeInTheDocument();
});

it("debounces valid email searches and does not query partial input", async () => {
  mount();
  search("candidate");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(
    candidateQuery.mock.calls.some(
      ([, , searchTerm]) => searchTerm === "candidate",
    ),
  ).toBe(false);

  search("first@example.test");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
  search("second@example.test");

  await waitFor(() =>
    expect(
      candidateQuery.mock.calls.some(
        ([, , searchTerm]) => searchTerm === "second@example.test",
      ),
    ).toBe(true),
  );
  expect(
    candidateQuery.mock.calls.some(
      ([, , searchTerm]) => searchTerm === "first@example.test",
    ),
  ).toBe(false);
});
