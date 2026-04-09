"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, MessageCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type AdminConversation = {
  id: string;
  user_id: string;
  status: "active" | "pending_human" | "resolved" | "archived";
  subject: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  last_message_at: string;
  unread_by_admin: boolean;
  created_at: string;
  profiles: {
    email: string;
    subscription_status: string | null;
  } | null;
};

type StatusFilter = "all" | "pending_human" | "active" | "resolved";

const STATUS_LABELS: Record<AdminConversation["status"], string> = {
  active: "Active",
  pending_human: "To handle",
  resolved: "Resolved",
  archived: "Archived",
};

const STATUS_COLORS: Record<AdminConversation["status"], string> = {
  active: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  pending_human: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  archived: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

export function SupportInbox({
  initialConversations,
}: {
  initialConversations: AdminConversation[];
}) {
  const [conversations, setConversations] =
    useState(initialConversations);
  const [filter, setFilter] = useState<StatusFilter>("pending_human");

  // Realtime: refresh on chat_conversations changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-support-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => {
          void fetch("/api/admin/chat/list?status=all&limit=100")
            .then(async (r) => r.json())
            .then((data: { conversations: AdminConversation[] }) => {
              setConversations(data.conversations);
            })
            .catch(() => {
              /* ignore */
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return conversations;
    return conversations.filter((c) => c.status === filter);
  }, [conversations, filter]);

  const counts = useMemo(() => {
    const c = { all: 0, pending_human: 0, active: 0, resolved: 0 };
    for (const conv of conversations) {
      c.all++;
      if (conv.status === "pending_human") c.pending_human++;
      else if (conv.status === "active") c.active++;
      else if (conv.status === "resolved") c.resolved++;
    }
    return c;
  }, [conversations]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="To handle"
          value={counts.pending_human}
          icon={<AlertCircle className="size-4 text-amber-500" />}
        />
        <StatCard
          label="Active"
          value={counts.active}
          icon={<MessageCircle className="size-4 text-blue-500" />}
        />
        <StatCard
          label="Resolved"
          value={counts.resolved}
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            key: "pending_human" as const,
            label: `To handle (${counts.pending_human})`,
          },
          { key: "active" as const, label: `Active (${counts.active})` },
          { key: "resolved" as const, label: `Resolved (${counts.resolved})` },
          { key: "all" as const, label: `All (${counts.all})` },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
          No conversations in this category.
        </div>
      ) : (
        <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
          {filtered.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`/dashboard/admin/support/${conv.id}`}
                className={cn(
                  "hover:bg-muted/40 flex items-start gap-4 px-4 py-3 transition",
                  conv.unread_by_admin && "bg-blue-500/5",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-foreground truncate text-sm",
                        conv.unread_by_admin && "font-semibold",
                      )}
                    >
                      {conv.subject ?? "(no subject)"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", STATUS_COLORS[conv.status])}
                    >
                      {STATUS_LABELS[conv.status]}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span>{conv.profiles?.email ?? "(unknown)"}</span>
                    <span>·</span>
                    <span>{conv.profiles?.subscription_status ?? "free"}</span>
                    {conv.escalation_reason && (
                      <>
                        <span>·</span>
                        <span className="text-amber-600">
                          {conv.escalation_reason}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  <span>{formatRelative(conv.last_message_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-card flex items-center gap-3 rounded-lg border p-3">
      {icon}
      <div className="flex flex-col">
        <span className="text-foreground text-xl leading-none font-semibold">
          {value}
        </span>
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString("en-US");
}
