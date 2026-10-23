import type { ReactNode } from"react";
import type { WorkIntakeFormType, WorkItemType } from"./work-types";

export type MonoIconName =
  |"sparkle"
  |"sliders"
  |"chart"
  |"calendar"
  |"user"
  |"users"
  |"link"
  |"copy"
  |"flag"
  |"clock"
  |"trash"
  |"eye"
  |"maximize"
  |"pin"
  |"lock"
  |"document"
  |"bolt"
  |"check"
  |"sync"
  |"comment"
  |"tag"
  |"folder"
  |"edit"
  |"alert"
  |"settings"
  |"arrowUpRight";

export function MonoIssueTypeIcon({
  type,
  size,
  className ="h-3.5 w-3.5",
}: {
  type: WorkItemType | WorkIntakeFormType |"SUBTASK"|"EPIC";
  size?: number;
  className?: string;
}): ReactNode {
  const normalized = type.toUpperCase();
  const dimensions = size ? { width: size, height: size } : undefined;
  if (normalized ==="BUG") {
    return (
      <svg
        viewBox="0 0 16 16"
        {...dimensions}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <rect x="4.5"y="4.5"width="7"height="8"rx="3.5"/>
        <path d="M6 4.5V3a2 2 0 0 1 4 0v1.5"/>
        <path d="M2 7h2.5M11.5 7H14M2 10h2.5M11.5 10H14"/>
      </svg>
    );
  }
  if (normalized ==="STORY") {
    return (
      <svg
        viewBox="0 0 16 16"
        {...dimensions}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M4 2.5h8a1 1 0 0 1 1 1v10l-5-3-5 3v-10a1 1 0 0 1 1-1z"/>
      </svg>
    );
  }
  if (normalized ==="EPIC") {
    return (
      <svg
        viewBox="0 0 16 16"
        {...dimensions}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <polygon points="9 1.5 3.5 9 8 9 7 14.5 12.5 7 8 7 9 1.5"/>
      </svg>
    );
  }
  if (normalized ==="SUBTASK") {
    return (
      <svg
        viewBox="0 0 16 16"
        {...dimensions}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <rect x="2.5"y="2.5"width="6"height="6"/>
        <rect x="7.5"y="7.5"width="6"height="6"/>
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      {...dimensions}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5"y="2.5"width="11"height="11"/>
      <polyline points="5.5 8 7.2 9.8 10.8 6.2"/>
    </svg>
  );
}

export function MonoIcon({
  name,
  size,
  className ="h-3.5 w-3.5 shrink-0",
}: {
  name: MonoIconName;
  size?: number;
  className?: string;
}): ReactNode {
  const dimensions = size ? { width: size, height: size } : undefined;
  switch (name) {
    case"sparkle":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M8 2l1.6 4.4L14 8l-4.4 1.6L8 14 6.4 9.6 2 8l4.4-1.6L8 2z"/>
        </svg>
      );
    case"sliders":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <line x1="2"y1="4"x2="14"y2="4"/>
          <line x1="2"y1="8"x2="14"y2="8"/>
          <line x1="2"y1="12"x2="14"y2="12"/>
          <circle cx="5.5"cy="4"r="1.5"fill="currentColor"/>
          <circle cx="10.5"cy="8"r="1.5"fill="currentColor"/>
          <circle cx="7"cy="12"r="1.5"fill="currentColor"/>
        </svg>
      );
    case"chart":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <line x1="3"y1="13"x2="3"y2="8"/>
          <line x1="8"y1="13"x2="8"y2="4"/>
          <line x1="13"y1="13"x2="13"y2="6"/>
        </svg>
      );
    case"calendar":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="2"y="3"width="12"height="11"/>
          <line x1="5"y1="1.5"x2="5"y2="4"/>
          <line x1="11"y1="1.5"x2="11"y2="4"/>
          <line x1="2"y1="6.5"x2="14"y2="6.5"/>
        </svg>
      );
    case"user":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="8"cy="5.5"r="2.5"/>
          <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"/>
        </svg>
      );
    case"users":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="6"cy="5.5"r="2"/>
          <path d="M2 13c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2"/>
          <circle cx="11.5"cy="6"r="1.5"/>
          <path d="M11.5 9.8c1.5 0 2.5 1 2.5 2.7"/>
        </svg>
      );
    case"link":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1.1 1"/>
          <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1.1-1"/>
        </svg>
      );
    case"copy":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="5.5"y="5.5"width="8"height="8"/>
          <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"/>
        </svg>
      );
    case"flag":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M3 2v12"/>
          <path d="M3 3h9l-2 3.5L12 10H3"/>
        </svg>
      );
    case"clock":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="8"cy="8"r="6"/>
          <polyline points="8 4.5 8 8 10.5 9.5"/>
        </svg>
      );
    case"trash":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <polyline points="2.5 4 13.5 4"/>
          <path d="M6 4V2.5h4V4"/>
          <path d="M4 4l.8 9.5a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9L12 4"/>
        </svg>
      );
    case"eye":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/>
          <circle cx="8"cy="8"r="2"/>
        </svg>
      );
    case"maximize":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <polyline points="10 2 14 2 14 6"/>
          <polyline points="6 14 2 14 2 10"/>
          <line x1="14"y1="2"x2="9.5"y2="6.5"/>
          <line x1="2"y1="14"x2="6.5"y2="9.5"/>
        </svg>
      );
    case"pin":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M9.5 2.5l4 4-1.5 1.5-2-1-2.5 2.5 1 2.5-1.5 1.5-3-3-2.5 2.5 2.5-2.5-3-3L2.5 6l2.5 1L7.5 4.5l-1-2L8 1z"/>
        </svg>
      );
    case"lock":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="3"y="7"width="10"height="7"/>
          <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
        </svg>
      );
    case"document":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z"/>
          <polyline points="9 2 9 6 13 6"/>
        </svg>
      );
    case"bolt":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <polygon points="9 1.5 3.5 9 8 9 7 14.5 12.5 7 8 7 9 1.5"/>
        </svg>
      );
    case"check":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <polyline points="3 8.5 6.5 12 13 4.5"/>
        </svg>
      );
    case"sync":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M13.5 8a5.5 5.5 0 0 1-9.3 3.9M2.5 8a5.5 5.5 0 0 1 9.3-3.9"/>
          <polyline points="11.5 2 12 4.5 9.5 4.5"/>
          <polyline points="4.5 14 4 11.5 6.5 11.5"/>
        </svg>
      );
    case"comment":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3.5 2.5v-9.5a1 1 0 0 1 1-1z"/>
        </svg>
      );
    case"tag":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M2.5 8.5V3a.5.5 0 0 1 .5-.5h5.5l5 5-5.5 5.5-5-4.5z"/>
          <circle cx="5.5"cy="5.5"r="1"fill="currentColor"/>
        </svg>
      );
    case"folder":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M2 4a1 1 0 0 1 1-1h3.5l1.5 1.5H13a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z"/>
        </svg>
      );
    case"edit":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z"/>
        </svg>
      );
    case"alert":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M8 2.5l6 11H2l6-11z"/>
          <line x1="8"y1="6.5"x2="8"y2="9.5"/>
          <circle cx="8"cy="11.5"r="0.5"fill="currentColor"/>
        </svg>
      );
    case"settings":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="8"cy="8"r="2.5"/>
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>
        </svg>
      );
    case"arrowUpRight":
      return (
        <svg
          viewBox="0 0 16 16"
          {...dimensions}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <line x1="4"y1="12"x2="12"y2="4"/>
          <polyline points="6 4 12 4 12 10"/>
        </svg>
      );
  }
}
