"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useForm, Form } from "@/features/form/tanstack-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FeatureStatus =
  | "new"
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "rejected";

type FeatureCategory =
  | "feature"
  | "improvement"
  | "integration"
  | "ui_ux"
  | "other";

type Feature = {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  status: FeatureStatus;
  category: FeatureCategory;
  priority: number;
  votes_count: number;
  source: string;
  needs_admin_review: boolean;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<FeatureStatus, string> = {
  new: "New",
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<FeatureStatus, string> = {
  new: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  under_review: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  planned: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  shipped: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
};

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  feature: "Feature",
  improvement: "Improvement",
  integration: "Integration",
  ui_ux: "UI/UX",
  other: "Other",
};

const STATUS_FILTERS: { key: FeatureStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "under_review", label: "Under review" },
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In progress" },
  { key: "shipped", label: "Shipped" },
];

const proposeSchema = z.object({
  title: z.string().min(3, "At least 3 characters").max(120),
  description: z.string().min(10, "At least 10 characters").max(2000),
  category: z.enum(["feature", "improvement", "integration", "ui_ux", "other"]),
});

export function FeatureRoadmap() {
  const session = useSession();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | "all">(
    "all",
  );
  const [sort, setSort] = useState<"votes" | "recent">("votes");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, sort });
      const res = await fetch(`/api/features?${params.toString()}`);
      const data = (await res.json()) as {
        features: Feature[];
        user_votes: string[];
        current_user_id: string | null;
      };
      setFeatures(data.features);
      setUserVotes(new Set(data.user_votes));
      setCurrentUserId(data.current_user_id);
    } catch {
      toast.error("Couldn't load the roadmap");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sort]);

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  // Smooth-scroll + highlight when arriving with a #feature-id anchor
  useEffect(() => {
    if (loading || features.length === 0) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const target = features.find((f) => f.id === hash);
    if (!target) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(hash);
      const t = setTimeout(() => setHighlightedId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [loading, features]);

  const toggleVote = useCallback(
    async (featureId: string) => {
      if (!session.data?.user) {
        toast.info("Sign in to vote");
        return;
      }

      const wasVoted = userVotes.has(featureId);
      setUserVotes((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.delete(featureId);
        else next.add(featureId);
        return next;
      });
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === featureId
            ? { ...f, votes_count: f.votes_count + (wasVoted ? -1 : 1) }
            : f,
        ),
      );

      try {
        const res = await fetch(`/api/features/${featureId}/vote`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("vote failed");
        const data = (await res.json()) as {
          voted: boolean;
          votes_count: number;
        };
        setFeatures((prev) =>
          prev.map((f) =>
            f.id === featureId ? { ...f, votes_count: data.votes_count } : f,
          ),
        );
      } catch {
        setUserVotes((prev) => {
          const next = new Set(prev);
          if (wasVoted) next.add(featureId);
          else next.delete(featureId);
          return next;
        });
        toast.error("Vote failed. Try again.");
        void fetchFeatures();
      }
    },
    [session.data?.user, userVotes, fetchFeatures],
  );

  const myPending = features.filter(
    (f) => f.needs_admin_review && f.user_id === currentUserId,
  );
  const publicFeatures = features.filter((f) => !f.needs_admin_review);

  return (
    <div className="flex flex-col gap-10">
      {/* Toolbar */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
          Filter & sort
        </h2>
        <div className="nm-raised flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  statusFilter === f.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "votes" | "recent")}
              className="border-border bg-background text-muted-foreground rounded-md border px-3 py-1.5 text-xs"
            >
              <option value="votes">Most votes</option>
              <option value="recent">Most recent</option>
            </select>
            <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Suggest
                </Button>
              </DialogTrigger>
              <ProposeFeatureDialog
                onCreated={() => {
                  setProposeOpen(false);
                  void fetchFeatures();
                }}
                isLoggedIn={Boolean(session.data?.user)}
              />
            </Dialog>
          </div>
        </div>
      </section>

      {/* User's own pending */}
      {!loading && myPending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
            Your suggestions awaiting review
          </h2>
          <div className="nm-raised rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Visible only to you and Vin until approved. Once approved, they
              appear on the public roadmap for everyone to vote.
            </p>
          </div>
          <ul className="nm-raised flex flex-col overflow-hidden rounded-2xl">
            {myPending.map((feature, i) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                voted={userVotes.has(feature.id)}
                onVote={() => void toggleVote(feature.id)}
                highlighted={highlightedId === feature.id}
                isPending
                isLast={i === myPending.length - 1}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Public roadmap */}
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground/60 px-1 text-xs font-medium tracking-wide uppercase">
          Public roadmap
        </h2>
        {loading ? (
          <div className="nm-raised flex items-center justify-center rounded-2xl py-16">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : publicFeatures.length === 0 ? (
          <div className="nm-raised text-muted-foreground rounded-2xl px-5 py-12 text-center text-sm">
            No features here yet. Be the first to suggest one!
          </div>
        ) : (
          <ul className="nm-raised flex flex-col overflow-hidden rounded-2xl">
            {publicFeatures.map((feature, i) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                voted={userVotes.has(feature.id)}
                onVote={() => void toggleVote(feature.id)}
                highlighted={highlightedId === feature.id}
                isLast={i === publicFeatures.length - 1}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FeatureRow({
  feature,
  voted,
  onVote,
  highlighted,
  isPending,
  isLast,
}: {
  feature: Feature;
  voted: boolean;
  onVote: () => void;
  highlighted?: boolean;
  isPending?: boolean;
  isLast?: boolean;
}) {
  return (
    <li
      id={feature.id}
      className={cn(
        "flex items-start gap-4 px-5 py-4 transition",
        !isLast && "border-b border-white/[0.04]",
        isPending && "bg-amber-500/[0.03]",
        highlighted && "ring-2 ring-blue-500/50 ring-inset",
      )}
    >
      <button
        type="button"
        onClick={onVote}
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition",
          voted
            ? "border-blue-500 bg-blue-500/10 text-blue-500"
            : "border-border/60 text-muted-foreground hover:border-blue-500/50 hover:text-blue-500",
        )}
        aria-label={voted ? "Remove vote" : "Vote"}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        <span>{feature.votes_count}</span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground text-sm font-medium">{feature.title}</p>
          <Badge
            variant="outline"
            className={cn("text-[10px]", STATUS_COLORS[feature.status])}
          >
            {STATUS_LABELS[feature.status]}
          </Badge>
          <span className="text-muted-foreground/60 text-[10px] tracking-wide uppercase">
            {CATEGORY_LABELS[feature.category]}
          </span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {feature.description}
        </p>
      </div>
    </li>
  );
}

function ProposeFeatureDialog({
  onCreated,
  isLoggedIn,
}: {
  onCreated: () => void;
  isLoggedIn: boolean;
}) {
  const form = useForm({
    schema: proposeSchema,
    defaultValues: {
      title: "",
      description: "",
      category: "feature" as const,
    },
    onSubmit: async (values) => {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Couldn't create the suggestion");
        return;
      }
      toast.success("Suggestion added to the roadmap!");
      onCreated();
    },
  });

  if (!isLoggedIn) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in required</DialogTitle>
          <DialogDescription>
            You need to be signed in to suggest a feature.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild>
            <a href="/login">Sign in</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Suggest a feature</DialogTitle>
        <DialogDescription>
          Describe your idea. It will appear in the public roadmap immediately
          for others to vote on.
        </DialogDescription>
      </DialogHeader>
      <Form form={form} className="flex flex-col gap-4">
        <form.AppField name="title">
          {(field) => (
            <field.Field>
              <field.Label>Title</field.Label>
              <field.Content>
                <field.Input placeholder="e.g. Add a PDF export" />
                <field.Message />
              </field.Content>
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.Field>
              <field.Label>Description</field.Label>
              <field.Content>
                <field.Textarea
                  rows={5}
                  placeholder="Explain what you want and why it's useful…"
                />
                <field.Message />
              </field.Content>
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="category">
          {(field) => (
            <field.Field>
              <field.Label>Category</field.Label>
              <field.Content>
                <field.Select>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">New feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="ui_ux">UI / UX</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </field.Select>
                <field.Message />
              </field.Content>
            </field.Field>
          )}
        </form.AppField>
        <DialogFooter>
          <form.SubmitButton>Publish my suggestion</form.SubmitButton>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}
