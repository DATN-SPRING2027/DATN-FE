import type { SVGProps } from "react";
import {
  UploadAlertCircleSvgIcon,
  UploadBatchStackSvgIcon,
  UploadCheckSvgIcon,
  UploadChunkSearchSvgIcon,
  UploadDedupeSvgIcon,
  UploadDismissSvgIcon,
  UploadDropzoneSvgIcon,
  UploadFileCodeSvgIcon,
  UploadFileDownloadSvgIcon,
  UploadFileImageSvgIcon,
  UploadFileInvalidSvgIcon,
  UploadFilePreviewSvgIcon,
  UploadFileReplaceSvgIcon,
  UploadFileSheetSvgIcon,
  UploadFileTextSvgIcon,
  UploadIndexDetachSvgIcon,
  UploadIndexReadySvgIcon,
  UploadIndexSyncSvgIcon,
  UploadPauseSvgIcon,
  UploadProgressArcSvgIcon,
  UploadResumeSvgIcon,
  UploadRetrySvgIcon,
  UploadRowOpenSvgIcon,
} from "@/icons";

type UploadIconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/** Multi-sheet upload intake icon for toolbar Bulk Upload trigger */
export function UploadBatchStackIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadBatchStackSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Architectural document-intake glyph for upload dropzones */
export function UploadDropzoneIcon({
  className = "h-5 w-5",
  ...props
}: UploadIconProps) {
  return (
    <UploadDropzoneSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Layered knowledge strata with checkmark — replaces generic AI sparkles */
export function UploadIndexReadyIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadIndexReadySvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Layered knowledge strata with upward intake arrow (Sync to index) */
export function UploadIndexSyncIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadIndexSyncSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Layered knowledge strata with detach minus line (Remove from index) */
export function UploadIndexDetachIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadIndexDetachSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Precision circular transfer arc for active upload / indexing */
export function UploadProgressArcIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadProgressArcSvgIcon
      aria-hidden="true"
      className={`${className} motion-safe:animate-spin`}
      {...props}
    />
  );
}

/** Minimal pause bars for active transfer / indexing */
export function UploadPauseIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadPauseSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Transfer continue / resume glyph (distinct from media player triangle) */
export function UploadResumeIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadResumeSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Counter-clockwise transfer retry arc */
export function UploadRetryIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadRetrySvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Twin-sheet content deduplication glyph */
export function UploadDedupeIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadDedupeSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Restrained circular alert glyph (replaces harsh warning triangle) */
export function UploadAlertCircleIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadAlertCircleSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Precision download-to-tray glyph for table row & file card */
export function UploadFileDownloadIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadFileDownloadSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Minimalist document inspection / preview glyph */
export function UploadFilePreviewIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadFilePreviewSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Swap / replace attachment glyph */
export function UploadFileReplaceIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadFileReplaceSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Clean dismiss / remove X glyph */
export function UploadDismissIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadDismissSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Diagonal open-detail arrow for table Actions column */
export function UploadRowOpenIcon({
  className = "h-4 w-4",
  ...props
}: UploadIconProps) {
  return (
    <UploadRowOpenSvgIcon aria-hidden="true" className={className} {...props} />
  );
}

/** Crisp inline checkmark */
export function UploadCheckIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadCheckSvgIcon aria-hidden="true" className={className} {...props} />
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
    return <UploadFileInvalidSvgIcon aria-hidden="true" className={className} />;
  }

  if (
    mime.startsWith("image/") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  ) {
    return <UploadFileImageSvgIcon aria-hidden="true" className={className} />;
  }

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".ods") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv")
  ) {
    return <UploadFileSheetSvgIcon aria-hidden="true" className={className} />;
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
    return <UploadFileCodeSvgIcon aria-hidden="true" className={className} />;
  }

  return <UploadFileTextSvgIcon aria-hidden="true" className={className} />;
}

/** Geometric 1.5px stroke loupe for filtering extracted document chunks */
export function UploadChunkSearchIcon({
  className = "h-3.5 w-3.5",
  ...props
}: UploadIconProps) {
  return (
    <UploadChunkSearchSvgIcon aria-hidden="true" className={className} {...props} />
  );
}
