"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircleIcon, AlertCircle, RefreshCw, Loader2 } from "@/lib/icons";

type ServiceStatus = {
  name: string;
  status: "ok" | "error" | "not_configured";
  detail?: string;
  code?: number;
};

type ServicesResponse = {
  services: ServiceStatus[];
  timestamp: string;
};

function ServiceRow({ svc }: { svc: ServiceStatus }) {
  const isOk = svc.status === "ok";
  const isUnconfigured = svc.status === "not_configured";

  const Icon = isOk ? CheckCircle : isUnconfigured ? AlertCircle : XCircleIcon;
  const color = isOk
    ? "text-emerald-400"
    : isUnconfigured
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <p className="text-sm">{svc.name}</p>
      </div>
      <span className={`text-[11px] ${color} opacity-80`}>
        {isOk ? (svc.detail ?? "OK") : isUnconfigured ? "non configuré" : (svc.detail ?? "erreur")}
      </span>
    </div>
  );
}

export function ServicesHealth() {
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } =
    useQuery<ServicesResponse>({
      queryKey: ["admin-services"],
      queryFn: async () => {
        const res = await fetch("/api/admin/services");
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json() as Promise<ServicesResponse>;
      },
      refetchInterval: 60_000,
      retry: 1,
    });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR")
    : null;

  return (
    <div className="nm-raised overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
        <p className="text-xs font-medium">Services externes</p>
        <button
          onClick={() => void refetch()}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Rafraîchir"
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
          <p className="text-muted-foreground text-sm">Vérification…</p>
        </div>
      ) : !data?.services ? (
        <div className="flex items-center gap-2 px-4 py-4">
          <XCircleIcon className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-400">Worker injoignable</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {data.services.map((svc) => (
            <ServiceRow key={svc.name} svc={svc} />
          ))}
        </div>
      )}

      {lastUpdated && (
        <p className="text-muted-foreground/30 border-t border-white/[0.04] px-4 py-1.5 text-[10px]">
          Mis à jour {lastUpdated}
        </p>
      )}
    </div>
  );
}
