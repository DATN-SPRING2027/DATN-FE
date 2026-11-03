"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "./auth.keys";
import { loadSignInSession, loginFromSharedForm } from "./sign-in-session";
import { notifyAuthSessionChanged } from "./session-sync";
import { useChatNavigation } from "@/stores/chat-navigation";
import { useFloatingChatStore } from "@/stores/floating-chat";

export function useSignInSessionQuery() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: loadSignInSession,
    retry: false,
    retryOnMount: false,
    staleTime: 0,
    refetchOnMount: (query) => query.getObserversCount() <= 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSharedLoginMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["login", "shared"],
    mutationFn: loginFromSharedForm,
    retry: false,
    onSuccess: async () => {
      // A new cookie context must never reuse the previous user's cached data.
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) =>
          !(
            query.queryKey.length === 2 &&
            query.queryKey[0] === "auth" &&
            query.queryKey[1] === "session"
          ),
      });
      useFloatingChatStore.getState().reset();
      useChatNavigation.getState().clear();
      notifyAuthSessionChanged();
    },
  });
}
