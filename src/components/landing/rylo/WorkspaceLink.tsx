"use client";

import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/icons";
import { hasClientSessionHint } from "@/lib/api-client";
import { useSignInSessionQuery } from "@/lib/queries/auth/useSharedSignIn";
import {
  ButtonRippleLayer,
  useHydratedReducedMotion,
  type ButtonRippleHandle,
} from "@/components/ui/button/buttonMotion";
import styles from "./landing.module.css";

const subscribeNoop = () => () => undefined;

interface WorkspaceLinkProps {
  subtle?: boolean;
  compact?: boolean;
  guestLabel?: string;
  hideIcon?: boolean;
  hasSessionCookie?: boolean;
}

export default function WorkspaceLink({
  subtle = false,
  compact = false,
  guestLabel,
  hideIcon = false,
  hasSessionCookie = false,
}: WorkspaceLinkProps) {
  const t = useTranslations("landingRylo");
  const hasSessionHint = useSyncExternalStore(
    subscribeNoop,
    hasClientSessionHint,
    () => hasSessionCookie,
  );
  const shouldProbeSession = hasSessionCookie || hasSessionHint;
  const session = useSignInSessionQuery({ enabled: shouldProbeSession });
  const shouldReduceMotion = useHydratedReducedMotion();
  const rippleRef = useRef<ButtonRippleHandle>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLAnchorElement>) => {
      if (subtle || shouldReduceMotion) return;
      rippleRef.current?.spawn(event);
    },
    [shouldReduceMotion, subtle],
  );

  if (
    shouldProbeSession &&
    (session.isLoading || (session.isPending && session.fetchStatus !== "idle"))
  ) {
    return (
      <span
        className={styles.sessionLoading}
        role="status"
        aria-label={t("sessionLoading")}
        aria-busy="true"
      />
    );
  }
  const href = !session.data
    ? "/signin"
    : session.data.context === "PLATFORM"
      ? "/platform"
      : session.data.context === "ACCOUNT"
        ? "/onboarding"
        : "/dashboard";
  return (
    <Link
      href={href}
      onPointerDown={handlePointerDown}
      className={subtle ? styles.textLink : styles.button}
    >
      {!subtle && (
        <ButtonRippleLayer ref={rippleRef} rippleClassName="bg-white/35" />
      )}
      {session.data
        ? t(compact ? "workspaceShort" : "workspace")
        : (guestLabel ?? t("signin"))}
      {!hideIcon && (
        <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
      )}
    </Link>
  );
}
