"use client";

import { useState } from "react";
import { Mail, Eye } from "@/lib/icons";

export function AnnouncementSendButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [sent, setSent] = useState<number | null>(null);

  const handleSend = async () => {
    if (!confirm("Send announcement to all opted-in users?")) {
      return;
    }

    setStatus("loading");
    setSent(null);
    try {
      const response = await fetch("/api/admin/send-announcement", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to send announcement");
      }

      const data = (await response.json()) as {
        sent: number;
        failed: number;
        total: number;
      };

      setSent(data.sent);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleTest = async () => {
    setStatus("loading");
    setSent(null);
    try {
      const response = await fetch("/api/admin/send-announcement?test=true", {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setStatus("success");
      setSent(1);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <a
          href="/api/admin/email-preview/announcement"
          target="_blank"
          rel="noopener noreferrer"
          className="nm-raised-sm text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </a>
        <button
          onClick={() => void handleTest()}
          disabled={status === "loading"}
          className="nm-raised-sm text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          {status === "loading" ? "Sending..." : "Send test"}
        </button>
        <button
          onClick={() => void handleSend()}
          disabled={status === "loading"}
          className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          Send to all
        </button>
        {status === "error" && (
          <span className="text-destructive text-xs">Error — retry</span>
        )}
      </div>
      {status === "success" && sent !== null && (
        <p className="text-xs text-emerald-400">
          Sent {sent} email{sent !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
