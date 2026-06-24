import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStats } from "../api/hooks";
import { clearToken, getToken, setToken } from "../lib/auth";
import { Card } from "../components/ui";
import { ErrorState, Loading } from "../components/state";
import { formatDateLong } from "../lib/format";

const btn =
  "min-h-12 rounded-xl px-4 font-semibold active:opacity-80 disabled:opacity-50";
const btnPrimary = btn + " bg-accent text-bg";
const btnSecondary = btn + " bg-surface-2 text-ink";

export default function Settings() {
  const qc = useQueryClient();
  const [token, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const stats = useStats();

  useEffect(() => {
    getToken().then((t) => setHasToken(!!t));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const save = async () => {
    if (!token.trim()) return;
    await setToken(token.trim());
    setHasToken(true);
    setSaved(true);
    setTokenInput("");
    setTimeout(() => setSaved(false), 1500);
    await qc.invalidateQueries();
  };

  const reset = async () => {
    await clearToken();
    await qc.clear();
    setHasToken(false);
  };

  const resetCache = async () => {
    await qc.clear();
  };

  const install = async () => {
    if (!installPrompt) return;
    const p = installPrompt as Event & { prompt: () => Promise<void> };
    await p.prompt();
    setInstallPrompt(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">API token</h2>
        <p className="text-sm text-muted">
          {hasToken === null
            ? "…"
            : hasToken
              ? "A token is configured. Replace it below if needed."
              : "Paste your APP_TOKEN to enable data fetching."}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            placeholder="bearer token"
            onChange={(e) => setTokenInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-ink placeholder:text-muted"
          />
          <button className={btnPrimary} type="button" onClick={save} disabled={!token.trim()}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        {hasToken && (
          <button className={btnSecondary} type="button" onClick={reset}>
            Clear token
          </button>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">Database stats</h2>
        {stats.isLoading ? (
          <Loading />
        ) : stats.error ? (
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Last activity</span>
              <strong>{formatDateLong(stats.data?.last_activity_at)}</strong>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-accent">Row counts</summary>
              <ul className="mt-2 flex flex-col gap-0.5">
                {(stats.data?.tables ?? []).map((t) => (
                  <li key={t.table_name} className="flex justify-between">
                    <span className="text-muted">{t.table_name}</span>
                    <strong className="tabular-nums">{t.rows}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Cache</h2>
        <button className={btnSecondary} type="button" onClick={resetCache}>
          Reset cache
        </button>
      </Card>

      {installPrompt && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Install app</h2>
          <button className={btnPrimary} type="button" onClick={install}>
            Add to home screen
          </button>
        </Card>
      )}
    </div>
  );
}
