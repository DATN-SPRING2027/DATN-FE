import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TeamContentState from "./TeamContentState";

it("announces loading without introducing Team data or actions", () => {
  render(<TeamContentState state="loading" message="Loading records" />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading records");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("renders an empty state using caller-provided copy", () => {
  render(
    <TeamContentState
      state="empty"
      title="No records"
      message="The approved view currently has no items."
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("No records");
  expect(screen.getByRole("status")).toHaveTextContent(
    "The approved view currently has no items.",
  );
});

it("shows a denied state without offering an authorization bypass", () => {
  render(
    <TeamContentState
      state="denied"
      title="Access unavailable"
      message="The server did not allow this action."
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Access unavailable");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("renders an error and invokes only the retry callback supplied by the caller", () => {
  const onRetry = vi.fn();
  render(
    <TeamContentState
      state="error"
      title="Could not load"
      message="Check the connection and try again."
      retry={{ label: "Retry", onRetry }}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("does not expose a retry action unless the caller provides one", () => {
  render(
    <TeamContentState
      state="error"
      title="Request failed"
      message="Refresh the view before continuing."
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("Request failed");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("renders caller-provided content without imposing a Team response shape", () => {
  render(
    <TeamContentState state="content">
      <p>Content supplied by an approved adapter</p>
    </TeamContentState>,
  );

  expect(
    screen.getByText("Content supplied by an approved adapter"),
  ).toBeVisible();
});
