import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OrganizationRowMenu from "./OrganizationRowMenu";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name: string }) =>
    key === "rowActions" ? `Actions for ${values?.name}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
describe("Organization row menu", () => {
  it("portals outside the table and closes on an outside pointer or Escape", () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <OrganizationRowMenu id="org" name="Acme" canManage />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    const trigger = screen.getByRole("button", { name: "Actions for Acme" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu").parentElement).toBe(document.body);
    expect(screen.getByRole("menuitem", { name: "view" })).toHaveFocus();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("keeps only one row menu open and omits editing for a read-only user", () => {
    render(
      <>
        <OrganizationRowMenu id="a" name="A" canManage />
        <OrganizationRowMenu id="b" name="B" canManage={false} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions for A" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions for B" }));
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu")).toHaveAccessibleName("Actions for B");
    expect(
      screen.queryByRole("menuitem", { name: "editAction" }),
    ).not.toBeInTheDocument();
  });
});
