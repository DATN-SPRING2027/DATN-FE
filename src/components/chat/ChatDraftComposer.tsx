"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import ChatComposer from "./ChatComposer";
import { chatFeatures } from "@/lib/queries/chat/features";

export default function ChatDraftComposer({
  conversationId,
  organizationId,
  ...props
}: ComponentProps<typeof ChatComposer> & {
  conversationId: string;
  organizationId: string;
}) {
  const t = useTranslations("chat");
  const [failed, setFailed] = useState(false);
  const draft = useQuery({
    queryKey: ["chat", organizationId, "draft", conversationId],
    queryFn: () => chatFeatures.draft(conversationId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const chain = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<
    { content: string; mentionUserIds: readonly string[] } | undefined
  >(undefined);
  const mounted = useRef(true);
  const enqueue = (value: {
    content: string;
    mentionUserIds: readonly string[];
  }) => {
    chain.current = chain.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await chatFeatures.saveDraft(
            conversationId,
            value.content,
            value.mentionUserIds,
          );
          if (mounted.current) setFailed(false);
        } catch {
          if (mounted.current) setFailed(true);
        }
      });
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
          const value = { content, mentionUserIds };
          latest.current = value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = undefined;
            enqueue(value);
          }, 600);
        }}
        onSend={async (...args) => {
          const success = await props.onSend(...args);
          if (success) {
            latest.current = { content: "", mentionUserIds: [] };
            if (timer.current) clearTimeout(timer.current);
            timer.current = undefined;
            enqueue({ content: "", mentionUserIds: [] });
          }
          return success;
        }}
      />
    </>
  );
}
