import type { ReactNode } from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-12 text-muted"
      role="status"
      aria-live="polite"
    >
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div
      className="flex flex-col items-center gap-3 py-12 text-center text-danger"
      role="alert"
    >
      <p>{msg}</p>
      {onRetry && (
        <button
          type="button"
          className="min-h-12 rounded-xl bg-surface-2 px-4 font-semibold text-ink active:opacity-80"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-12 text-center text-muted">{children}</div>;
}
