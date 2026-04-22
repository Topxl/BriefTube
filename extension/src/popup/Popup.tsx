import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Zap,
} from "lucide-react";
import type { MeResponse } from "@/lib/types";

async function send<T>(
  type: string,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, resolve);
  });
}

export function Popup() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await send<MeResponse>("ME");
    if (res.ok && res.data) setMe(res.data);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    await send("SIGN_IN");
    setSigningIn(false);
    await refresh();
  };

  const handleSignOut = async () => {
    await send("SIGN_OUT");
    await refresh();
  };

  return (
    <div className="flex min-h-[380px] w-[340px] flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-brand flex size-8 items-center justify-center rounded-lg">
            <Zap className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">BriefTube</p>
            <p className="text-[10px] tracking-wider text-white/50 uppercase">
              AI YouTube summaries
            </p>
          </div>
        </div>
        <a
          href="https://www.brief-tube.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="rounded-md p-1.5 text-white/60 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="size-4" />
        </a>
      </header>

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-brand size-5 animate-spin" />
          </div>
        ) : (
          <>
            {me?.authenticated ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">Signed in</p>
                    <p className="truncate text-[11px] text-white/60">
                      {me.user?.email ?? ""}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  {me.quota.isPro ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="size-4 text-emerald-400" />
                      <span className="font-medium">Pro: unlimited</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-white/60">Today</span>
                        <span className="text-sm font-semibold">
                          {me.quota.used}/{me.quota.limit ?? "?"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="bg-brand h-full"
                          style={{
                            width: `${Math.min(
                              100,
                              ((me.quota.used || 0) / (me.quota.limit ?? 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-white/50">
                        Resets at midnight UTC
                      </p>
                    </>
                  )}
                </div>

                {!me.quota.isPro ? (
                  <a
                    href="https://www.brief-tube.com/dashboard/billing"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-brand hover:bg-brand-dark flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition"
                  >
                    Upgrade to Pro <ArrowUpRight className="size-3.5" />
                  </a>
                ) : null}

                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-xs text-white/70">
                    You have{" "}
                    <span className="font-medium text-white">
                      {me?.quota.remaining ?? 3} free
                    </span>{" "}
                    summaries today without an account.
                  </p>
                  <p className="mt-1 text-[11px] text-white/50">
                    Sign in to get 10/day free, save your summaries, and
                    subscribe to channels.
                  </p>
                </div>
                <button
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="bg-brand hover:bg-brand-dark flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60"
                >
                  {signingIn ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  Sign in with Google
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-white/40">
        BriefTube · brief-tube.com
      </footer>
    </div>
  );
}
