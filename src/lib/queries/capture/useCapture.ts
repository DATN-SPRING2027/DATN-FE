"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { captureKeys } from "./capture.keys";

export type WorkNote = Readonly<{
  id: string;
  date: string;
  what: string;
  how: string;
  why: string;
  jiraIssueKey?: string;
  createdAt: string;
}>;

export type SaveWorkNoteInput = Readonly<{
  date: string;
  what: string;
  how: string;
  why: string;
  jiraIssueKey?: string;
}>;

export function useDailyWorkNotesQuery(
  date: string,
  options?: Omit<UseQueryOptions<readonly WorkNote[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    ...options,
    queryKey: captureKeys.daily(date),
    queryFn: () =>
      apiClient<readonly WorkNote[]>(`/work-notes?date=${encodeURIComponent(date)}`),
  });
}

export function useSaveWorkNoteMutation(
  options?: Omit<UseMutationOptions<WorkNote, Error, SaveWorkNoteInput>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (note: SaveWorkNoteInput) =>
      apiClient<WorkNote>("/work-notes", {
        method: "POST",
        body: JSON.stringify(note),
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: captureKeys.daily(args[1].date) });
      options?.onSuccess?.(...args);
    },
  });
}
