"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircleIcon,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
} from "@/lib/icons";

type ServiceStatus = {
  name: string;
  status: "ok" | "error" | "not_configured";
  detail?: string;
  code?: number;
};

type ServiceGroup = {
  id: string;
  label: string;
  services: ServiceStatus[];
};

type ServicesResponse = {
  groups: ServiceGroup[];
  timestamp: string;
};

type GroupHealth = "ok" | "warning" | "error" | "not_configured";

function computeGroupHealth(group: ServiceGroup): GroupHealth {
  const { services } = group;
  // RSS and TTS groups have fixed "ok" services from the backend
  const allUnconfigured = services.every((s) => s.status === "not_configured");
  if (allUnconfigured) return "not_configured";
  const anyOk = services.some((s) => s.status === "ok");
  const anyError = services.some((s) => s.status === "error");
  if (anyOk && anyError) return "warning"; // degraded — some sources work, some don't
  if (!anyOk && anyError) return "error";
  return "ok";
}

function StatusIcon({
  status,
  className,
}: {
  status: GroupHealth | ServiceStatus["status"];
  className?: string;
}) {
  if (status === "ok")
    return (
      <CheckCircle
        className={`h-3 w-3 shrink-0 text-emerald-400 ${className ?? ""}`}
      />
    );
  if (status === "warning")
    return (
      <AlertCircle
        className={`h-3 w-3 shrink-0 text-yellow-400 ${className ?? ""}`}
      />
    );
  if (status === "error")
    return (
      <XCircleIcon
        className={`h-3 w-3 shrink-0 text-red-400 ${className ?? ""}`}
      />
    );
  // not_configured
  return (
    <AlertCircle
      className={`h-3 w-3 shrink-0 text-white/20 ${className ?? ""}`}
    />
  );
}

function statusColor(status: GroupHealth | ServiceStatus["status"]) {
  if (status === "ok") return "text-emerald-400";
  if (status === "warning") return "text-yellow-400";
  if (status === "error") return "text-red-400";
  return "text-white/25";
}

function statusLabel(status: ServiceStatus["status"], detail?: string) {
  if (status === "ok") return detail ?? "OK";
  if (status === "not_configured") return "not configured";
  return detail ?? "error";
}

function ServiceRow({ svc, isLast }: { svc: ServiceStatus; isLast: boolean }) {
  const color = statusColor(svc.status);
  return (
    <div className="flex items-start gap-2">
      {/* Tree connector */}
      <div className="mt-[3px] flex shrink-0 flex-col items-center">
        <div
          className={`h-3 w-px ${isLast ? "bg-transparent" : "bg-white/[0.08]"}`}
        />
        <div className="h-px w-3 bg-white/[0.08]" />
        {!isLast && <div className="w-px flex-1 bg-white/[0.08]" />}
      </div>
      <StatusIcon status={svc.status} className="mt-[1px]" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="text-[11px] text-white/60">{svc.name}</span>
        <span className={`truncate text-[10px] ${color} opacity-70`}>
          {statusLabel(svc.status, svc.detail)}
        </span>
      </div>
    </div>
  );
}

const GROUP_STEP: Record<string, string> = {
  rss: "①",
  transcript: "②",
  summary: "③",
  tts: "④",
  delivery: "⑤",
};

function PipelineStage({
  group,
  isLast,
}: {
  group: ServiceGroup;
  isLast: boolean;
}) {
  const health = computeGroupHealth(group);
  const color = statusColor(health);
  const step = GROUP_STEP[group.id] ?? "·";

  const badgeLabel =
    health === "warning"
      ? "degraded"
      : health === "error"
        ? "error"
        : health === "not_configured"
          ? "not configured"
          : null;

  return (
    <>
      <div className="px-4 py-2.5">
        {/* Stage header */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25 tabular-nums">{step}</span>
          <StatusIcon status={health} />
          <p className="text-xs font-medium">{group.label}</p>
          {badgeLabel && (
            <span className={`ml-auto text-[10px] ${color} opacity-70`}>
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Services tree */}
        {group.services.length > 0 && (
          <div className="mt-2 ml-5 flex flex-col gap-1">
            {group.services.map((svc, i) => (
              <ServiceRow
                key={svc.name}
                svc={svc}
                isLast={i === group.services.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Arrow connector between stages */}
      {!isLast && (
        <div className="flex justify-center py-0.5">
          <ChevronDown className="h-3 w-3 text-white/[0.12]" />
        </div>
      )}
    </>
  );
}

export function ServicesHealth() {
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } =
    useQuery<ServicesResponse>({
      queryKey: ["admin-services"],
      queryFn: async () => {
        const res = await fetch("/api/admin/services");
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status}: ${body}`);
        }
        return res.json() as Promise<ServicesResponse>;
      },
      refetchInterval: 60_000,
      retry: 1,
    });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US")
    : null;

  return (
    <div className="nm-raised overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
        <p className="text-xs font-medium">Processing pipeline</p>
        <button
          onClick={() => void refetch()}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Refresh"
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-4 py-4">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          <p className="text-muted-foreground text-sm">Checking…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col gap-1 px-4 py-4">
          <p className="text-xs font-medium text-red-400">Services API error</p>
          <p className="font-mono text-[10px] text-red-400/70">
            {error.message}
          </p>
        </div>
      ) : !data?.groups ? (
        <div className="flex items-center gap-2 px-4 py-4">
          <XCircleIcon className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-400">Worker unreachable</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {data.groups.map((group, i) => (
            <PipelineStage
              key={group.id}
              group={group}
              isLast={i === data.groups.length - 1}
            />
          ))}
        </div>
      )}

      {lastUpdated && (
        <p className="text-muted-foreground/30 border-t border-white/[0.04] px-4 py-1.5 text-[10px]">
          Updated {lastUpdated}
        </p>
      )}
    </div>
  );
}
