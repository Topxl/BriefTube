"use client";

import { useState } from "react";
import {
  Save,
  Send,
  TestTube,
  Loader2,
  Eye,
  FileEdit,
  Archive,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClientMarkdown } from "@/features/markdown/client-markdown";

type LetterFull = {
  id: string;
  episode_number: number;
  week_start: string;
  week_end: string;
  status: "draft" | "scheduled" | "sent" | "cancelled" | "skipped";
  title: string | null;
  subject: string | null;
  intro_narrative: string | null;
  new_cliffhanger: string | null;
  generated_data: {
    features_shipped?: { title: string; votes_count: number }[];
    changelog_entries?: { type: string; text: string }[];
    stats?: {
      new_users_count: number;
      active_users_count: number;
      summaries_processed: number;
    };
  };
  arc_state_snapshot: {
    current_arc_title?: string;
    open_threads?: { title: string; status: string }[];
  };
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
};

export function LetterEditor({ initialLetter }: { initialLetter: LetterFull }) {
  const [letter, setLetter] = useState(initialLetter);
  const [title, setTitle] = useState(initialLetter.title ?? "");
  const [subject, setSubject] = useState(initialLetter.subject ?? "");
  const [body, setBody] = useState(initialLetter.intro_narrative ?? "");
  const [cliffhanger, setCliffhanger] = useState(
    initialLetter.new_cliffhanger ?? "",
  );
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);

  const isSent = letter.status === "sent";

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/letters/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          intro_narrative: body,
          new_cliffhanger: cliffhanger || null,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success("Saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      // Save first to ensure latest version is sent
      await fetch(`/api/admin/letters/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          intro_narrative: body,
        }),
      });
      const res = await fetch(`/api/admin/letters/${letter.id}/test-send`, {
        method: "POST",
      });
      const data = (await res.json()) as { sent_to?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "test failed");
      toast.success(`Test sent to ${data.sent_to ?? "admin"}`);
    } catch {
      toast.error("Test send failed");
    } finally {
      setTesting(false);
    }
  };

  const sendToAll = async () => {
    if (
      !confirm(
        `Really send Episode ${letter.episode_number} to all subscribers? This cannot be undone.`,
      )
    )
      return;
    setSending(true);
    try {
      // Save first
      await fetch(`/api/admin/letters/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject,
          intro_narrative: body,
        }),
      });
      const res = await fetch(`/api/admin/letters/${letter.id}/send`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "send failed");
      toast.success(`Sent to ${data.sent} recipients (${data.failed} failed)`);
      setLetter((l) => ({
        ...l,
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: data.sent ?? 0,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel this letter? It won't be sent.")) return;
    try {
      const res = await fetch(`/api/admin/letters/${letter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("cancel failed");
      setLetter((l) => ({ ...l, status: "cancelled" }));
      toast.success("Cancelled");
    } catch {
      toast.error("Cancel failed");
    }
  };

  const features = letter.generated_data.features_shipped ?? [];
  const changelog = letter.generated_data.changelog_entries ?? [];
  const stats = letter.generated_data.stats;
  const openThreads = letter.arc_state_snapshot.open_threads ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex flex-col items-center gap-0.5 text-xs">
            <span className="text-foreground text-xl leading-none font-semibold">
              {letter.episode_number}
            </span>
            <span>ep.</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold">
              {title || "(untitled episode)"}
            </h1>
            <p className="text-muted-foreground text-xs">
              Week {letter.week_start} → {letter.week_end} ·{" "}
              <Badge variant="outline" className="ml-1 text-xs">
                {letter.status}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isSent && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void sendTest()}
                disabled={testing || sending}
              >
                {testing ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <TestTube className="mr-1 size-4" />
                )}
                Test to me
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void save()}
                disabled={saving || sending}
              >
                {saving ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <Save className="mr-1 size-4" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                onClick={() => void sendToAll()}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                  <Send className="mr-1 size-4" />
                )}
                Send to all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void cancel()}
                disabled={sending}
              >
                <Archive className="mr-1 size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        {/* Left: title + subject + body editor + preview */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Episode title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSent}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Email subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSent}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground block text-xs font-medium">
                Narrative body (markdown)
              </label>
              <div className="border-border/60 flex overflow-hidden rounded-md border text-xs">
                {[
                  {
                    key: "edit" as const,
                    icon: <FileEdit className="size-3" />,
                    label: "Edit",
                  },
                  { key: "split" as const, label: "Split" },
                  {
                    key: "preview" as const,
                    icon: <Eye className="size-3" />,
                    label: "Preview",
                  },
                ].map((v, i) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 transition",
                      i > 0 && "border-border/60 border-l",
                      view === v.key
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.icon}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={cn("grid gap-3", view === "split" && "md:grid-cols-2")}
            >
              {(view === "edit" || view === "split") && (
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={22}
                  disabled={isSent}
                  placeholder="The narrative body in markdown..."
                  className="border-input bg-background w-full resize-none rounded-md border px-3 py-2 font-mono text-xs leading-relaxed"
                />
              )}
              {(view === "preview" || view === "split") && (
                <div className="border-border/60 bg-muted/30 max-h-[600px] min-h-[300px] overflow-y-auto rounded-md border p-5">
                  {body.trim().length > 0 ? (
                    <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ClientMarkdown>{body}</ClientMarkdown>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      Preview will appear here…
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Cliffhanger for next episode
            </label>
            <textarea
              value={cliffhanger}
              onChange={(e) => setCliffhanger(e.target.value)}
              rows={2}
              disabled={isSent}
              placeholder="What you tease for next week..."
              className="border-input bg-background w-full resize-none rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Right: source data sidebar */}
        <aside className="border-border/60 bg-card flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h3 className="text-foreground text-sm font-semibold">
              Sources used
            </h3>
          </div>

          {features.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Features shipped
              </p>
              <ul className="flex flex-col gap-1">
                {features.map((f, i) => (
                  <li key={i} className="text-foreground text-xs">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      ({f.votes_count} votes)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changelog.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Changelog
              </p>
              <ul className="flex flex-col gap-1">
                {changelog.slice(0, 8).map((c, i) => (
                  <li key={i} className="text-foreground text-xs">
                    <span className="text-muted-foreground">{c.type}:</span>{" "}
                    {c.text.slice(0, 80)}
                    {c.text.length > 80 && "…"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Week stats
              </p>
              <dl className="text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">New users</dt>
                  <dd>{stats.new_users_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Active</dt>
                  <dd>{stats.active_users_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Summaries</dt>
                  <dd>{stats.summaries_processed}</dd>
                </div>
              </dl>
            </div>
          )}

          {openThreads.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Open story threads
              </p>
              <ul className="flex flex-col gap-1">
                {openThreads.map((t, i) => (
                  <li key={i} className="text-foreground text-xs">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-muted-foreground"> ({t.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isSent && (
            <div className="border-border/60 mt-2 rounded-md border bg-emerald-500/5 p-2">
              <p className="text-xs text-emerald-600">
                Sent to {letter.recipient_count} recipients
              </p>
              {letter.sent_at && (
                <p className="text-muted-foreground text-xs">
                  {new Date(letter.sent_at).toLocaleString("fr-FR")}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
