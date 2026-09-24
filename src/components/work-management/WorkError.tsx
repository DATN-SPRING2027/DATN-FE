import { secondaryButtonClassName } from "./work-management-ui";

type WorkErrorProps = Readonly<{
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}>;

export default function WorkError({
  title,
  message,
  onRetry,
  retryLabel,
}: WorkErrorProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-500/30 bg-warning-50 p-4 text-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300"
      role="alert"
    >
      <div>
        {title && <h3 className="font-semibold">{title}</h3>}
        <p className={title ? "mt-1" : ""}>{message}</p>
      </div>
      {onRetry && retryLabel && (
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
