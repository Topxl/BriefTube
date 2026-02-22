"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  RefreshCw,
  Terminal,
  Power,
  Loader2,
  Play,
  Pause,
} from "@/lib/icons";

type WorkerApiResponse = {
  workerStatus: {
    active: boolean;
    status: string;
    pid: string | null;
    memory: string | null;
    cpu: string | null;
    since: string | null;
  };
  logLines: string[];
  recentErrors: string[];
  errorCount: number;
  timestamp: string;
};

function LogLine({ line }: { line: string }) {
  const isError = line.includes("] ERROR") || line.includes("] CRITICAL");
  const isWarning = line.includes("] WARNING");
  const isSuccess = line.includes("✅") || line.includes("Done:");

  const color = isError
    ? "text-red-400"
    : isWarning
      ? "text-yellow-400"
      : isSuccess
        ? "text-emerald-400"
        : "text-muted-foreground";

  // Split timestamp from rest for visual hierarchy
  const parts = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+) (.*)$/);
  if (parts) {
    return (
      <div className={`font-mono text-[10px] leading-5 ${color}`}>
        <span className="text-white/20">{parts[1]} </span>
        <span>{parts[2]}</span>
      </div>
    );
  }

  return (
    <div className={`font-mono text-[10px] leading-5 ${color}`}>{line}</div>
  );
}

export function WorkerCard() {
  const queryClient = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery<WorkerApiResponse>({
    queryKey: ["admin-worker"],
    queryFn: async () => {
      const res = await fetch("/api/admin/worker");
      if (!res.ok) throw new Error("Failed to fetch worker status");
      return res.json() as Promise<WorkerApiResponse>;
    },
    refetchInterval: 10_000,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: "start" | "stop" | "restart") => {
      const res = await fetch("/api/admin/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json() as Promise<{ success: boolean; action: string }>;
    },
    onSuccess: (_, action) => {
      toast.success(`Worker ${action} sent`);
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["admin-worker"] });
      }, 2500);
    },
    onError: () => {
      toast.error("Action failed");
    },
  });

  const worker = data?.workerStatus;
  const isActive = worker?.active ?? false;
  const isBusy = actionMutation.isPending;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR")
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Status header */}
      <div className="nm-raised flex items-center justify-between rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              isLoading
                ? "bg-yellow-400"
                : isActive
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"
            }`}
          />
          <div>
            <p className="text-sm font-medium">
              {isLoading ? "Chargement…" : (worker?.status ?? "unknown")}
            </p>
            {worker?.since && (
              <p className="text-muted-foreground text-[11px]">
                depuis {worker.since}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {worker?.pid && (
            <div className="text-right">
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                PID
              </p>
              <p className="font-mono text-xs font-medium">{worker.pid}</p>
            </div>
          )}
          {worker?.memory && (
            <div className="text-right">
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                RAM
              </p>
              <p className="font-mono text-xs font-medium">{worker.memory}</p>
            </div>
          )}
          {worker?.cpu && (
            <div className="text-right">
              <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                CPU
              </p>
              <p className="font-mono text-xs font-medium">{worker.cpu}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full text-xs"
          disabled={isBusy || isActive}
          onClick={() => actionMutation.mutate("start")}
        >
          <Play className="h-3 w-3" />
          Start
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full text-xs"
          disabled={isBusy || !isActive}
          onClick={() => actionMutation.mutate("stop")}
        >
          <Pause className="h-3 w-3" />
          Stop
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full text-xs"
          disabled={isBusy}
          onClick={() => actionMutation.mutate("restart")}
        >
          {isBusy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Restart
        </Button>

        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/20">
          <Activity className="h-3 w-3" />
          {lastUpdated ? `Mis à jour ${lastUpdated}` : "…"}
        </div>
      </div>

      {/* Recent errors */}
      {(data?.recentErrors.length ?? 0) > 0 && (
        <div className="nm-raised rounded-2xl border border-red-500/[0.12] bg-red-500/[0.04] px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <p className="text-xs font-medium text-red-400">
              {data?.errorCount} erreur
              {(data?.errorCount ?? 0) > 1 ? "s" : ""} récente
              {(data?.errorCount ?? 0) > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            {data?.recentErrors.map((line, i) => (
              <LogLine key={i} line={line} />
            ))}
          </div>
        </div>
      )}

      {/* Live logs */}
      <div className="nm-raised overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-4 py-2">
          <Terminal className="text-muted-foreground h-3.5 w-3.5" />
          <p className="text-muted-foreground text-xs font-medium">
            Logs (60 dernières lignes)
          </p>
          <div className="ml-auto flex gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500/60" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              <span className="text-muted-foreground text-xs">Chargement…</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {(data?.logLines ?? []).map((line, i) => (
                <LogLine key={i} line={line} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Power icon watermark */}
      <div className="flex items-center justify-center gap-1.5 py-1">
        <Power className="h-3 w-3 text-white/10" />
        <span className="text-[10px] text-white/10">
          brieftube-worker.service
        </span>
      </div>
    </div>
  );
}
