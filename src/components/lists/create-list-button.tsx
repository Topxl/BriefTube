"use client";

import { Plus } from "@/lib/icons";
import { useRouter } from "next/navigation";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";

type Props = {
  variant?: "default" | "inline";
};

export function CreateListButton({ variant = "default" }: Props) {
  const router = useRouter();

  const handleCreate = () => {
    dialogManager.input({
      title: "New list",
      input: { label: "Name", placeholder: "e.g. Tech Channels" },
      action: {
        label: "Create",
        onClick: async (name) => {
          const res = await fetch("/api/lists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const data = (await res.json()) as { id: string; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Failed to create list");
          router.push(`/lists/${data.id}/edit`);
        },
      },
    });
  };

  if (variant === "inline") {
    return (
      <button
        onClick={handleCreate}
        suppressHydrationWarning
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        New list
      </button>
    );
  }

  return (
    <button
      onClick={handleCreate}
      suppressHydrationWarning
      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)] transition-all hover:bg-red-500"
      aria-label="Create list"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
