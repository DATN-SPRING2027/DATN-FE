"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import ChatComposer from "./ChatComposer";
import { chatFeatures } from "@/lib/queries/chat/features";

const pendingDraftSaves = new Map<string, Promise<void>>();

export default function ChatDraftComposer({
  conversationId,
  organizationId,
  ...props
}: ComponentProps<typeof ChatComposer> & {
  conversationId: string;
  organizationId: string;
}) {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const saveScopeKey = `${organizationId}:${conversationId}`;
  const draftQueryKey = [
    "chat",
    organizationId,
    "draft",
    conversationId,
  ] as const;

  const draft = useQuery({
    queryKey: draftQueryKey,
    queryFn: async () => {
      await pendingDraftSaves.get(saveScopeKey)?.catch(() => undefined);
      return chatFeatures.draft(conversationId);
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<
    { content: string; mentionUserIds: readonly string[] } | undefined
  >(undefined);
  const mounted = useRef(true);
  const enqueue = (value: {
    content: string;
    mentionUserIds: readonly string[];
  }) => {
    const normalized = {
      content: value.content,
      mentionUserIds: [...value.mentionUserIds],
    };
    queryClient.setQueryData(draftQueryKey, normalized);
    const prior = pendingDraftSaves.get(saveScopeKey) ?? Promise.resolve();
    const next = prior
      .catch(() => undefined)
      .then(async () => {
        try {
          await chatFeatures.saveDraft(
            conversationId,
            normalized.content,
            normalized.mentionUserIds,
          );
          queryClient.setQueryData(draftQueryKey, normalized);
          if (mounted.current) setFailed(false);
        } catch {
          if (mounted.current) setFailed(true);
        }
      })
      .finally(() => {
        if (pendingDraftSaves.get(saveScopeKey) === next) {
          pendingDraftSaves.delete(saveScopeKey);
        }
      });
    pendingDraftSaves.set(saveScopeKey, next);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
        if (latest.current !== undefined) enqueue(latest.current);
      }
    };
    // The parent keys this component by conversation; never flush into another room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (draft.isPending)
    return (
      <p role="status" className="shrink-0 p-3 text-sm">
        {t("loadingDraft")}
      </p>
    );
  if (draft.isError)
    return (
      <div className="shrink-0 p-3 text-sm">
        <p role="alert">{t("draftLoadError")}</p>
        <button className="underline" onClick={() => void draft.refetch()}>
          {t("retry")}
        </button>
      </div>
    );
  return (
    <>
      {failed && (
        <p role="alert" className="shrink-0 px-3 text-sm text-error-600">
          {t("draftSaveError")}{" "}
          <button
            className="underline"
            onClick={() =>
              enqueue(
                latest.current ?? {
                  content: draft.data.content,
                  mentionUserIds: draft.data.mentionUserIds ?? [],
                },
              )
            }
          >
            {t("retry")}
          </button>
        </p>
      )}
      <ChatComposer
        {...props}
        initialValue={draft.data.content}
        initialMentionUserIds={draft.data.mentionUserIds}
        onDraftChange={(content, mentionUserIds) => {
          const value = { content, mentionUserIds: [...mentionUserIds] };
          latest.current = value;
          queryClient.setQueryData(draftQueryKey, value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = undefined;
            enqueue(value);
          }, 600);
        }}
        onSend={async (...args) => {
          const success = await props.onSend(...args);
          if (success) {
            const emptyDraft = { content: "", mentionUserIds: [] };
            latest.current = emptyDraft;
            queryClient.setQueryData(draftQueryKey, emptyDraft);
            if (timer.current) clearTimeout(timer.current);
            timer.current = undefined;
            enqueue(emptyDraft);
          }
          return success;
        }}
      />
    </>
  );
}
