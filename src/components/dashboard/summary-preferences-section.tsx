"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  ListChecks,
  Loader2,
  MessageSquareText,
  Pencil,
  Zap,
} from "@/lib/icons";

type LengthPref = "brief" | "standard" | "detailed" | "auto";
type StylePref = "key_points" | "narrative" | "actionable";

const LENGTH_OPTIONS: { value: LengthPref; label: string; desc: string }[] = [
  {
    value: "brief",
    label: "Brief",
    desc: "~1 min audio, key takeaways only",
  },
  {
    value: "standard",
    label: "Standard",
    desc: "~4 min audio, balanced coverage",
  },
  {
    value: "detailed",
    label: "Detailed",
    desc: "~8 min audio, comprehensive",
  },
  {
    value: "auto",
    label: "Auto",
    desc: "Scales with video length (1-8 min)",
  },
];

const STYLE_OPTIONS: {
  value: StylePref;
  label: string;
  desc: string;
  icon: typeof FileText;
}[] = [
  {
    value: "key_points",
    label: "Key points",
    desc: "Structured list of main ideas",
    icon: ListChecks,
  },
  {
    value: "narrative",
    label: "Narrative",
    desc: "Flowing story, easy to listen to",
    icon: MessageSquareText,
  },
  {
    value: "actionable",
    label: "Actionable",
    desc: "Focus on what you can apply",
    icon: Zap,
  },
];

const INSTRUCTIONS_MAX = 500;

type Props = {
  initialLength: string;
  initialStyle: string;
  initialCustomInstructions: string;
};

export function SummaryPreferencesSection({
  initialLength,
  initialStyle,
  initialCustomInstructions,
}: Props) {
  const supabase = createClient();
  const [length, setLength] = useState<LengthPref>(initialLength as LengthPref);
  const [style, setStyle] = useState<StylePref>(initialStyle as StylePref);
  const [instructions, setInstructions] = useState(initialCustomInstructions);
  const [saving, setSaving] = useState(false);
  const [saveTimer, setSaveTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [expanded, setExpanded] = useState<
    "length" | "style" | "instructions" | null
  >(null);

  const save = async (
    field:
      | "summary_length_pref"
      | "summary_style"
      | "summary_custom_instructions",
    value: string,
  ) => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const payload =
        field === "summary_length_pref"
          ? { summary_length_pref: value }
          : field === "summary_style"
            ? { summary_style: value }
            : { summary_custom_instructions: value };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to save preference");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Length preference — clickable row */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => (v === "length" ? null : "length"))}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <FileText className="text-muted-foreground h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Summary length</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
            )}
            <span className="text-muted-foreground text-xs">
              {LENGTH_OPTIONS.find((o) => o.value === length)?.label}
            </span>
            <span className="text-muted-foreground/50 text-xs">
              {expanded === "length" ? "−" : "+"}
            </span>
          </div>
        </button>
        {expanded === "length" && (
          <div className="flex gap-2 border-t border-white/[0.04] px-4 py-3">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => {
                  setLength(opt.value);
                  void save("summary_length_pref", opt.value);
                }}
                className={`flex flex-1 flex-col rounded-xl px-3 py-2.5 text-left transition-all ${
                  length === opt.value
                    ? "nm-inset border border-red-500/20"
                    : "nm-raised-sm hover:nm-raised"
                }`}
              >
                <span
                  className={`text-xs font-semibold ${length === opt.value ? "text-red-400" : "text-foreground"}`}
                >
                  {opt.label}
                </span>
                <span className="text-muted-foreground mt-0.5 text-[10px] leading-tight">
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Style preference — clickable row */}
      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => (v === "style" ? null : "style"))}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <MessageSquareText className="text-muted-foreground h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Summary style</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {STYLE_OPTIONS.find((o) => o.value === style)?.label}
            </span>
            <span className="text-muted-foreground/50 text-xs">
              {expanded === "style" ? "−" : "+"}
            </span>
          </div>
        </button>
        {expanded === "style" && (
          <div className="flex flex-col gap-2 border-t border-white/[0.04] px-4 py-3">
            {STYLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  disabled={saving}
                  onClick={() => {
                    setStyle(opt.value);
                    void save("summary_style", opt.value);
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    style === opt.value
                      ? "nm-inset border border-red-500/20"
                      : "nm-raised-sm hover:nm-raised"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${style === opt.value ? "text-red-400" : "text-muted-foreground"}`}
                  />
                  <div>
                    <span
                      className={`text-xs font-semibold ${style === opt.value ? "text-red-400" : "text-foreground"}`}
                    >
                      {opt.label}
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-tight">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom instructions — clickable row */}
      <div>
        <button
          type="button"
          onClick={() =>
            setExpanded((v) => (v === "instructions" ? null : "instructions"))
          }
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2.5">
            <div className="nm-inset-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Pencil className="text-muted-foreground h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Custom instructions</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {instructions ? "Configured" : "None"}
            </span>
            <span className="text-muted-foreground/50 text-xs">
              {expanded === "instructions" ? "−" : "+"}
            </span>
          </div>
        </button>
        {expanded === "instructions" && (
          <div className="border-t border-white/[0.04] px-4 py-3">
            <textarea
              value={instructions}
              maxLength={INSTRUCTIONS_MAX}
              rows={3}
              placeholder="Focus on business insights&#10;Ignore sponsored segments&#10;Always mention numbers and data"
              onChange={(e) => {
                const val = e.target.value;
                setInstructions(val);
                if (saveTimer) clearTimeout(saveTimer);
                setSaveTimer(
                  setTimeout(() => {
                    void save("summary_custom_instructions", val);
                  }, 1000),
                );
              }}
              className="nm-inset text-foreground placeholder:text-muted-foreground/50 w-full resize-none rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
            />
            <p className="text-muted-foreground/40 mt-1 text-right text-[10px]">
              {instructions.length}/{INSTRUCTIONS_MAX}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
