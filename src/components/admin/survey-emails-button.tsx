"use client";

import { useState } from "react";
import { Eye, Mail } from "@/lib/icons";
import {
  triggerSurveyEmails,
  sendTestSurveyEmail,
} from "@app/dashboard/admin/actions";
import { SiteConfig } from "@/site-config";

export function SurveyEmailsButton() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");

  const handleSend = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const data = await triggerSurveyEmails();
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleTest = async () => {
    setTestStatus("loading");
    try {
      const res = await sendTestSurveyEmail();
      setTestStatus(res.ok ? "sent" : "error");
    } catch {
      setTestStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <a
          href={`${SiteConfig.prodUrl}/api/admin/email-preview/survey_feedback`}
          target="_blank"
          rel="noopener noreferrer"
          className="nm-raised-sm text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </a>
        <button
          onClick={() => void handleTest()}
          disabled={testStatus === "loading"}
          className="nm-raised-sm text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          {testStatus === "loading"
            ? "Sending..."
            : testStatus === "sent"
              ? "Test sent"
              : "Send test"}
        </button>
        <button
          onClick={() => void handleSend()}
          disabled={status === "loading"}
          className="nm-raised-sm flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" />
          {status === "loading" ? "Sending..." : "Send to all"}
        </button>
        {status === "error" && (
          <span className="text-destructive text-xs">Error — try again</span>
        )}
      </div>
      {status === "success" && result && (
        <div className="text-muted-foreground flex gap-4 text-xs">
          <span>
            <span className="text-emerald-400">{result.sent} sent</span>
            {result.skipped > 0 && `, ${result.skipped} skipped`}
            {result.errors > 0 && (
              <span className="text-red-400">, {result.errors} errors</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
