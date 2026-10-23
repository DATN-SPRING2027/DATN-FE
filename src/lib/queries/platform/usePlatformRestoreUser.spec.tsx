import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import { usePlatformRestoreUserMutation } from "./usePlatformOperations";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiClient: vi.fn(),
}));

const user = {
  id: "651a2b3c4d5e6f7a8b9c0d21",
  email: "member@example.test",
  fullName: "Member",
  avatarUrl: null,
  status: "SUSPENDED",
  archivedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-21T12:00:00.000Z",
  memberships: [],
  membershipsTruncated: false,
};
const input = {
  userId: user.id,
  expectedUpdatedAt: "2026-10-20T12:00:00.000Z",
  reasonCode: "ACCESS_REVIEW" as const,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(usePlatformRestoreUserMutation, { wrapper }),
    invalidate,
  };
}

beforeEach(() => {
  vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-csrf=restore-csrf");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(apiClient).mockReset();
});

describe("Platform account restoration", () => {
  it("uses CSRF and CAS, refreshes private projections and keeps the account suspended", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      ...user,
      passwordHash: "private",
    });
    const { result, invalidate } = setup();
    await act(async () => {
      const restored = await result.current.mutateAsync(input);
      expect(restored.status).toBe("SUSPENDED");
      expect(restored.archivedAt).toBeNull();
      expect(restored).not.toHaveProperty("passwordHash");
    });
    const [path, options] = vi.mocked(apiClient).mock.calls[0];
    expect(path).toBe(`/iam/platform/users/${user.id}/restore`);
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe(
      "restore-csrf",
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      expectedUpdatedAt: input.expectedUpdatedAt,
      reasonCode: "ACCESS_REVIEW",
    });
    expect(invalidate).toHaveBeenCalled();
    expect(apiClient).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: "ACTIVE" },
    { archivedAt: input.expectedUpdatedAt },
    { id: "651a2b3c4d5e6f7a8b9c0d22" },
  ])(
    "rejects a response that violates restore semantics: %j",
    async (override) => {
      vi.mocked(apiClient).mockResolvedValue({ ...user, ...override });
      const { result } = setup();
      await act(async () => {
        await expect(result.current.mutateAsync(input)).rejects.toBeInstanceOf(
          ApiError,
        );
      });
      expect(apiClient).toHaveBeenCalledTimes(1);
    },
  );

  it("refreshes stale data after a conflict without retrying the restore", async () => {
    vi.mocked(apiClient).mockRejectedValue(
      new ApiError(409, "USER_VERSION_STALE", "stale"),
    );
    const { result, invalidate } = setup();
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({
        status: 409,
      });
    });
    expect(invalidate).toHaveBeenCalled();
    expect(apiClient).toHaveBeenCalledTimes(1);
  });
});
