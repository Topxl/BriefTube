"use client";

import { useState } from "react";
import { Eye, Mail, Users } from "@/lib/icons";
import {
  triggerSurveyEmails,
  sendTestSurveyEmail,
} from "@app/dashboard/admin/actions";

type Target = "all" | "active" | "inactive";
type Status = "idle" | "loading" | "success" | "error";

export function SurveyEmailsButton() {
  const [sendStatus, setSendStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [testActiveStatus, setTestActiveStatus] = useState<Status>("idle");
  const [testInactiveStatus, setTestInactiveStatus] = useState<Status>("idle");

  const handleSend = async (target: Target) => {
    setSendStatus("loading");
    setResult(null);
    try {
      const data = await triggerSurveyEmails(target);
      setResult(data);
      setSendStatus("success");
    } catch {
      setSendStatus("error");
    }
  };

  const handleTest = async (persona: "active" | "inactive") => {
    const setter =
      persona === "active" ? setTestActiveStatus : setTestInactiveStatus;
    setter("loading");
    try {
      const res = await sendTestSurveyEmail(persona);
      setter(res.ok ? "success" : "error");
    } catch {
      setter("error");
    }
  };

  const testLabel = (status: Status, label: string) =>
    status === "loading" ? "Sending..." : status === "success" ? "Sent" : label;

  const btnClass =
    "nm-raised-sm text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Preview + Test emails */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/admin/email-preview/survey_feedback"
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </a>
        <button
          onClick={() => void handleTest("active")}
          disabled={testActiveStatus === "loading"}
          className={btnClass}
        >
          <Mail className="h-3.5 w-3.5" />
          {testLabel(testActiveStatus, "Test active")}
        </button>
        <button
          onClick={() => void handleTest("inactive")}
          disabled={testInactiveStatus === "loading"}
          className={btnClass}
        >
          <Mail className="h-3.5 w-3.5" />
          {testLabel(testInactiveStatus, "Test inactive")}
        </button>
      </div>

      {/* Row 2: Send buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void handleSend("active")}
          disabled={sendStatus === "loading"}
          className={btnClass}
        >
          <Users className="h-3.5 w-3.5" />
          {sendStatus === "loading" ? "Sending..." : "Send to active"}
        </button>
        <button
          onClick={() => void handleSend("inactive")}
          disabled={sendStatus === "loading"}
          className={btnClass}
        >
          <Users className="h-3.5 w-3.5" />
          {sendStatus === "loading" ? "Sending..." : "Send to inactive"}
        </button>
        <button
          onClick={() => void handleSend("all")}
          disabled={sendStatus === "loading"}
          className={btnClass}
        >
          <Mail className="h-3.5 w-3.5" />
          {sendStatus === "loading" ? "Sending..." : "Send to all"}
        </button>
      </div>

      {/* Results */}
      {sendStatus === "error" && (
        <span className="text-destructive text-xs">Error — try again</span>
      )}
      {sendStatus === "success" && result && (
        <div className="text-muted-foreground text-xs">
          <span className="text-emerald-400">{result.sent} sent</span>
          {result.skipped > 0 && `, ${result.skipped} skipped`}
          {result.errors > 0 && (
            <span className="text-red-400">, {result.errors} errors</span>
          )}
        </div>
      )}
    </div>
  );
}
