import type { SVGProps } from "react";

type UploadIconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

const BASE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
};

/** Multi-sheet upload intake icon for toolbar Bulk Upload trigger */
export function UploadBatchStackIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M4.75 15.25v2A2.5 2.5 0 0 0 7.25 19.75h9.5a2.5 2.5 0 0 0 2.5-2.5v-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 16.5h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <path
        d="M12 13.75V4.25M8.5 7.75L12 4.25l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Architectural document-intake glyph for upload dropzones */
export function UploadDropzoneIcon({
  className = "h-5 w-5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M13.5 3.75H7.75A2.5 2.5 0 0 0 5.25 6.25v11.5a2.5 2.5 0 0 0 2.5 2.5h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.25 3.75v3.5a1.5 1.5 0 0 0 1.5 1.5h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 3.75L18.25 8.5v2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.75 20.25v-6.5M14.25 16.25l2.5-2.5 2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Layered knowledge strata with checkmark — replaces generic AI sparkles */
export function UploadIndexReadyIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M12 3.5L4.75 7.25 12 11l7.25-3.75L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.75 11.75L10.25 14.6M4.75 16L10.25 18.85"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.25 16.25l2 2 3.5-3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Layered knowledge strata with upward intake arrow (Sync to index) */
export function UploadIndexSyncIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M12 3.5L4.75 7.25 12 11l7.25-3.75L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.75 11.75L10.5 14.75M4.75 16L10.5 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 19.75v-6M14.75 16L17 13.75 19.25 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Layered knowledge strata with detach minus line (Remove from index) */
export function UploadIndexDetachIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M12 3.5L4.75 7.25 12 11l7.25-3.75L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.75 11.75L10.5 14.75M4.75 16L10.5 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.25 16.5h5.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Precision circular transfer arc for active upload / indexing */
export function UploadProgressArcIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg
      {...BASE_PROPS}
      className={`${className} motion-safe:animate-spin`}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.22"
      />
      <path
        d="M12 3.75A8.25 8.25 0 0 1 20.25 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Minimal pause bars for active transfer / indexing */
export function UploadPauseIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.25 9.25v5.5M13.75 9.25v5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Transfer continue / resume glyph (distinct from media player triangle) */
export function UploadResumeIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M6.75 7.25v9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10.25 12h7.5M14.25 8.5L17.75 12l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Counter-clockwise transfer retry arc */
export function UploadRetryIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M5.25 4.75v4.5h4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.65 9.25a7.25 7.25 0 1 1 .95 7.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Twin-sheet content deduplication glyph */
export function UploadDedupeIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M9 4.25h7.25A2.25 2.25 0 0 1 18.5 6.5v8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.5"
        y="7.25"
        width="10"
        height="12.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 13.5l1.6 1.6 3.15-3.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Restrained circular alert glyph (replaces harsh warning triangle) */
export function UploadAlertCircleIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 8.25v4.25M12 15.5h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Precision download-to-tray glyph for table row & file card */
export function UploadFileDownloadIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M4.75 15.5v1.75a2.5 2.5 0 0 0 2.5 2.5h9.5a2.5 2.5 0 0 0 2.5-2.5V15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 4.5v9.75M8.5 10.75L12 14.25l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Minimalist document inspection / preview glyph */
export function UploadFilePreviewIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M2.75 12S6.25 6.25 12 6.25 21.25 12 21.25 12 17.75 17.75 12 17.75 2.75 12 2.75 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Swap / replace attachment glyph */
export function UploadFileReplaceIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M17.75 8.25H6.25M9.5 5L6.25 8.25 9.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.25 15.75h11.5M14.5 12.5l3.25 3.25L14.5 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clean dismiss / remove X glyph */
export function UploadDismissIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M7.25 7.25l9.5 9.5M16.75 7.25l-9.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Diagonal open-detail arrow for table Actions column */
export function UploadRowOpenIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M7.5 16.5l9-9M9.25 7.5h7.25v7.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Crisp inline checkmark */
export function UploadCheckIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path
        d="M5.75 12.5l4 4 8.5-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Monochrome architectural file-format glyph.
 * Adapts internal linework to document family (sheet, code, image, invalid, text)
 * so file lists never rely on rainbow colored text squares.
 */
export function UploadFileGlyph({
  fileName,
  contentType,
  invalid = false,
  className = "h-4 w-4",
}: {
  fileName?: string;
  contentType?: string;
  invalid?: boolean;
  className?: string;
}) {
  const lower = (fileName ?? "").toLowerCase();
  const mime = (contentType ?? "").toLowerCase();

  if (invalid) {
    return (
      <svg {...BASE_PROPS} className={className}>
        <path
          d="M14 3.75H7.75a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2V8L14 3.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 11.25l4 4M14 11.25l-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (
    mime.startsWith("image/") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  ) {
    return (
      <svg {...BASE_PROPS} className={className}>
        <rect
          x="4.25"
          y="4.75"
          width="15.5"
          height="14.5"
          rx="2.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="9" cy="9.25" r="1.25" fill="currentColor" />
        <path
          d="M4.75 16.25l4.25-3.75 3.25 2.75 3-2.5 4 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".ods") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv")
  ) {
    return (
      <svg {...BASE_PROPS} className={className}>
        <path
          d="M14 3.75H7.75a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2V8L14 3.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="8.5"
          y="10.25"
          width="7"
          height="6"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.35"
        />
        <path
          d="M12 10.25v6M8.5 13.25h7"
          stroke="currentColor"
          strokeWidth="1.35"
        />
      </svg>
    );
  }

  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".sql") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  ) {
    return (
      <svg {...BASE_PROPS} className={className}>
        <path
          d="M14 3.75H7.75a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2V8L14 3.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.25 11.5L8.5 13.25 10.25 15M13.75 11.5l1.75 1.75-1.75 1.75"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...BASE_PROPS} className={className}>
      <path
        d="M13.75 3.75H7.75a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2V8.25l-4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 3.75v3.25a1.5 1.5 0 0 0 1.5 1.5h3.25M8.75 12h6.5M8.75 15.25h4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Geometric 1.5px stroke loupe for filtering extracted document chunks */
export function UploadChunkSearchIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <circle
        cx="11"
        cy="11"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15.6 15.6L19.5 19.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
