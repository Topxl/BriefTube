"use client";

import { useState } from "react";
import { useForm, Form } from "@/features/form/tanstack-form";
import {
  activeSurveySchema,
  inactiveSurveySchema,
  type ActiveSurveyValues,
  type InactiveSurveyValues,
  type SurveyPersona,
  PMF_OPTIONS,
  BENEFIT_OPTIONS,
  IMPROVEMENT_OPTIONS,
  REFERRAL_OPTIONS,
  SIGNUP_REASON_OPTIONS,
  BLOCKER_OPTIONS,
  CONVINCE_OPTIONS,
  DELIVERY_PREF_OPTIONS,
} from "@/lib/survey/survey-schema";

type Props = { token: string; persona: SurveyPersona };

export function SurveyForm({ token, persona }: Props) {
  if (persona === "active") {
    return <ActiveSurveyForm token={token} />;
  }
  return <InactiveSurveyForm token={token} />;
}

function ActiveSurveyForm({ token }: { token: string }) {
  const [status, setStatus] = useState<
    "idle" | "success" | "already" | "error"
  >("idle");

  const form = useForm({
    schema: activeSurveySchema,
    defaultValues: {
      persona: "active",
      q1_pmf: undefined,
      q1_other: "",
      q2_benefit: undefined,
      q2_other: "",
      q3_improvement: [],
      q3_other: "",
      q4_referral: undefined,
      q4_other: "",
      q5_freetext: "",
    } as unknown as ActiveSurveyValues,
    onSubmit: async (values) => {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, data: values }),
      });
      const data = await res.json();
      if (data.status === "success") setStatus("success");
      else if (data.status === "already_responded") setStatus("already");
      else setStatus("error");
    },
  });

  if (status === "success") {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-8 text-center">
        <h2 className="text-xl font-bold text-white">Thank you!</h2>
        <p className="text-muted-foreground mt-3">
          Your feedback means a lot. Your free month of Pro is now active.
        </p>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-8 text-center">
        <h2 className="text-xl font-bold text-white">Already submitted</h2>
        <p className="text-muted-foreground mt-3">
          You've already completed this survey. Your free month was activated.
        </p>
      </div>
    );
  }

  return (
    // @ts-expect-error - Form type compatibility
    <Form form={form} className="flex flex-col gap-8">
      <QuestionSection
        number={1}
        title="How would you feel if you could no longer use BriefTube?"
      >
        <form.AppField name="q1_pmf">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={PMF_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q1_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={2}
        title="What is the main benefit you get from BriefTube?"
      >
        <form.AppField name="q2_benefit">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={BENEFIT_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q2_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={3}
        title="What would make BriefTube twice as useful?"
      >
        <form.AppField name="q3_improvement">
          {(field) => (
            <field.Field>
              <CheckboxGroup field={field} options={IMPROVEMENT_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q3_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={4}
        title="Who in your life would benefit most from BriefTube?"
      >
        <form.AppField name="q4_referral">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={REFERRAL_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q4_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={5}
        title="Anything else you want us to know?"
        optional
      >
        <form.AppField name="q5_freetext">
          {(field) => (
            <field.Field>
              <field.Textarea
                placeholder="Optional — but we read every response"
                className="min-h-[80px] border-white/[0.06] bg-zinc-800"
              />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      {status === "error" && (
        <p className="text-sm text-red-400">
          Something went wrong. Please try again.
        </p>
      )}

      <form.SubmitButton className="w-full bg-red-600 hover:bg-red-500">
        Submit & unlock 1 free month
      </form.SubmitButton>
    </Form>
  );
}

function InactiveSurveyForm({ token }: { token: string }) {
  const [status, setStatus] = useState<
    "idle" | "success" | "already" | "error"
  >("idle");

  const form = useForm({
    schema: inactiveSurveySchema,
    defaultValues: {
      persona: "inactive",
      q1_signup_reason: undefined,
      q1_other: "",
      q2_blocker: [],
      q2_other: "",
      q3_convince: [],
      q3_other: "",
      q4_delivery_pref: undefined,
      q4_other: "",
      q5_freetext: "",
    } as unknown as InactiveSurveyValues,
    onSubmit: async (values) => {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, data: values }),
      });
      const data = await res.json();
      if (data.status === "success") setStatus("success");
      else if (data.status === "already_responded") setStatus("already");
      else setStatus("error");
    },
  });

  if (status === "success") {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-8 text-center">
        <h2 className="text-xl font-bold text-white">Thank you!</h2>
        <p className="text-muted-foreground mt-3">
          Your feedback means a lot. Your free month of Pro is now active.
        </p>
      </div>
    );
  }

  if (status === "already") {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-8 text-center">
        <h2 className="text-xl font-bold text-white">Already submitted</h2>
        <p className="text-muted-foreground mt-3">
          You've already completed this survey. Your free month was activated.
        </p>
      </div>
    );
  }

  return (
    // @ts-expect-error - Form type compatibility
    <Form form={form} className="flex flex-col gap-8">
      <QuestionSection number={1} title="What made you sign up for BriefTube?">
        <form.AppField name="q1_signup_reason">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={SIGNUP_REASON_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q1_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection number={2} title="What stopped you from using it?">
        <form.AppField name="q2_blocker">
          {(field) => (
            <field.Field>
              <CheckboxGroup field={field} options={BLOCKER_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q2_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={3}
        title="What would convince you to try it again?"
      >
        <form.AppField name="q3_convince">
          {(field) => (
            <field.Field>
              <CheckboxGroup field={field} options={CONVINCE_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q3_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={4}
        title="How would you prefer to receive summaries?"
      >
        <form.AppField name="q4_delivery_pref">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={DELIVERY_PREF_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
        <form.AppField name="q4_other">
          {(field) => (
            <field.Field>
              <OtherField field={field} />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={5}
        title="Anything else we should know?"
        optional
      >
        <form.AppField name="q5_freetext">
          {(field) => (
            <field.Field>
              <field.Textarea
                placeholder="Optional — but we read every response"
                className="min-h-[80px] border-white/[0.06] bg-zinc-800"
              />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      {status === "error" && (
        <p className="text-sm text-red-400">
          Something went wrong. Please try again.
        </p>
      )}

      <form.SubmitButton className="w-full bg-red-600 hover:bg-red-500">
        Submit & unlock 1 free month
      </form.SubmitButton>
    </Form>
  );
}

function QuestionSection({
  number,
  title,
  optional,
  children,
}: {
  number: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900 p-5">
      <p className="mb-3 text-sm font-medium text-white">
        <span className="text-muted-foreground mr-2">Q{number}.</span>
        {title}
        {optional && (
          <span className="text-muted-foreground ml-1 text-xs">(optional)</span>
        )}
      </p>
      {children}
    </div>
  );
}

function OtherField({ field }: { field: unknown }) {
  const typedField = field as {
    state: { value: string };
    handleChange: (value: string) => void;
  };

  const [open, setOpen] = useState(!!typedField.state.value);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        + Add a comment
      </button>
    );
  }

  return (
    <textarea
      value={typedField.state.value}
      onChange={(e) => typedField.handleChange(e.target.value)}
      placeholder="Tell us more..."
      className="mt-2 w-full rounded-lg border border-white/[0.06] bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-600/50 focus:outline-none"
      rows={2}
    />
  );
}

function RadioGroup({
  field,
  options,
}: {
  field: unknown;
  options: readonly { value: string; label: string }[];
}) {
  const typedField = field as {
    state: { value: string };
    handleChange: (value: string) => void;
    name: string;
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
            typedField.state.value === opt.value
              ? "border-red-600 bg-red-600/10 text-white"
              : "border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:text-white"
          }`}
        >
          <input
            type="radio"
            name={typedField.name}
            value={opt.value}
            checked={typedField.state.value === opt.value}
            onChange={() => typedField.handleChange(opt.value)}
            className="sr-only"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({
  field,
  options,
}: {
  field: unknown;
  options: readonly { value: string; label: string }[];
}) {
  const typedField = field as {
    state: { value: string[] };
    handleChange: (value: string[]) => void;
  };

  const values: string[] = typedField.state.value;
  const toggle = (val: string) => {
    const next = values.includes(val)
      ? values.filter((v) => v !== val)
      : [...values, val];
    typedField.handleChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
            values.includes(opt.value)
              ? "border-red-600 bg-red-600/10 text-white"
              : "border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:text-white"
          }`}
        >
          <input
            type="checkbox"
            checked={values.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="sr-only"
          />
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              values.includes(opt.value)
                ? "border-red-600 bg-red-600"
                : "border-white/20"
            }`}
          >
            {values.includes(opt.value) && (
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </span>
          {opt.label}
        </label>
      ))}
    </div>
  );
}
