"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Edit3, X, Eye, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientMarkdown } from "@/features/markdown/client-markdown";

type KbArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
  enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export function AdminKbEditor({
  initialArticles,
}: {
  initialArticles: KbArticle[];
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [editing, setEditing] = useState<KbArticle | "new" | null>(null);

  const handleSave = async (
    article: Partial<KbArticle>,
    isNew: boolean,
  ): Promise<boolean> => {
    try {
      if (isNew) {
        const res = await fetch("/api/admin/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: article.title,
            content: article.content,
            category: article.category ?? "general",
            enabled: article.enabled ?? true,
            position: article.position ?? 0,
          }),
        });
        if (!res.ok) throw new Error("create failed");
        const data = (await res.json()) as { article: KbArticle };
        setArticles((prev) => [...prev, data.article]);
        toast.success("Article created");
      } else {
        const res = await fetch(`/api/admin/kb/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: article.title,
            content: article.content,
            category: article.category,
            enabled: article.enabled,
            position: article.position,
          }),
        });
        if (!res.ok) throw new Error("update failed");
        const data = (await res.json()) as { article: KbArticle };
        setArticles((prev) =>
          prev.map((a) => (a.id === data.article.id ? data.article : a)),
        );
        toast.success("Article updated");
      }
      return true;
    } catch {
      toast.error("Save failed");
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try {
      const res = await fetch(`/api/admin/kb/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setArticles((prev) => prev.filter((a) => a.id !== id));
      toast.success("Article deleted");
    } catch {
      toast.error("Couldn't delete");
    }
  };

  const toggleEnabled = async (article: KbArticle) => {
    const newEnabled = !article.enabled;
    setArticles((prev) =>
      prev.map((a) =>
        a.id === article.id ? { ...a, enabled: newEnabled } : a,
      ),
    );
    try {
      const res = await fetch(`/api/admin/kb/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) throw new Error("toggle failed");
    } catch {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === article.id ? { ...a, enabled: !newEnabled } : a,
        ),
      );
      toast.error("Couldn't update");
    }
  };

  const grouped = articles.reduce<Record<string, KbArticle[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {articles.length} article{articles.length > 1 ? "s" : ""} •{" "}
          {articles.filter((a) => a.enabled).length} active
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="mr-1 size-4" />
          New article
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {category}
            </h3>
            <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
              {items.map((article) => (
                <li
                  key={article.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={article.enabled}
                    onChange={() => void toggleEnabled(article)}
                    className="mt-1 size-4 shrink-0"
                    title="Enabled / disabled"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(article)}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-1 text-left transition hover:opacity-80",
                      !article.enabled && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {article.title}
                      </span>
                      {!article.enabled && (
                        <Badge variant="outline" className="text-xs">
                          disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {article.content.slice(0, 200)}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(article)}
                      title="Edit"
                    >
                      <Edit3 className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void handleDelete(article.id)}
                      title="Delete"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <KbArticleDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        target={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  );
}

function KbArticleDialog({
  target,
  onClose,
  onSave,
}: {
  target: KbArticle | "new" | null;
  onClose: () => void;
  onSave: (article: Partial<KbArticle>, isNew: boolean) => Promise<boolean>;
}) {
  const isNew = target === "new";
  const article = isNew ? null : target;

  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [category, setCategory] = useState(article?.category ?? "general");
  const [position, setPosition] = useState(article?.position ?? 0);
  const [enabled, setEnabled] = useState(article?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"edit" | "preview" | "split">("split");

  if (!target) return null;

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content required");
      return;
    }
    setSaving(true);
    const ok = await onSave(
      {
        id: article?.id,
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || "general",
        position,
        enabled,
      },
      isNew,
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New article" : "Edit article"}</DialogTitle>
          <DialogDescription>
            Articles Léa uses to answer users. Edit the markdown. The preview
            updates live.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Position
              </label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value, 10) || 0)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                Enabled
              </label>
              <select
                value={enabled ? "on" : "off"}
                onChange={(e) => setEnabled(e.target.value === "on")}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="on">Yes</option>
                <option value="off">No</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground block text-xs font-medium">
                Content (markdown)
              </label>
              <div className="border-border/60 flex overflow-hidden rounded-md border text-xs">
                <button
                  type="button"
                  onClick={() => setView("edit")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 transition",
                    view === "edit"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileEdit className="size-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setView("split")}
                  className={cn(
                    "border-border/60 flex items-center gap-1 border-x px-2 py-1 transition",
                    view === "split"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => setView("preview")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 transition",
                    view === "preview"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="size-3" />
                  Preview
                </button>
              </div>
            </div>
            <div
              className={cn("grid gap-3", view === "split" && "md:grid-cols-2")}
            >
              {(view === "edit" || view === "split") && (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={18}
                  placeholder="Write the article in markdown…"
                  className="border-input bg-background w-full resize-none rounded-md border px-3 py-2 font-mono text-xs"
                />
              )}
              {(view === "preview" || view === "split") && (
                <div className="border-border/60 bg-muted/30 max-h-[420px] min-h-[200px] overflow-y-auto rounded-md border p-4">
                  {content.trim().length > 0 ? (
                    <ClientMarkdown className="prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {content}
                    </ClientMarkdown>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      Preview will appear here…
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-1 size-4" />
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <Save className="mr-1 size-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
