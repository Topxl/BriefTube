"use client";

import { useState } from "react";
import { useForm, Form } from "@/features/form/tanstack-form";
import {
  surveySchema,
  type SurveyFormValues,
  PMF_OPTIONS,
  BENEFIT_OPTIONS,
  FRICTION_OPTIONS,
  IMPROVEMENT_OPTIONS,
  REFERRAL_OPTIONS,
} from "@/lib/survey/survey-schema";

type Props = { token: string };

export function SurveyForm({ token }: Props) {
  const [status, setStatus] = useState<
    "idle" | "success" | "already" | "error"
  >("idle");

  const form = useForm({
    schema: surveySchema,
    defaultValues: {
      q1_pmf: undefined,
      q2_benefit: undefined,
      q3_friction: [],
      q4_improvement: [],
      q5_referral: undefined,
      q6_freetext: "",
    } as unknown as SurveyFormValues,
    onSubmit: async (values) => {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, token }),
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
      </QuestionSection>

      <QuestionSection number={3} title="What stopped you or slowed you down?">
        <form.AppField name="q3_friction">
          {(field) => (
            <field.Field>
              <CheckboxGroup field={field} options={FRICTION_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={4}
        title="What would make BriefTube twice as useful?"
      >
        <form.AppField name="q4_improvement">
          {(field) => (
            <field.Field>
              <CheckboxGroup field={field} options={IMPROVEMENT_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={5}
        title="Who in your life would benefit most from BriefTube?"
      >
        <form.AppField name="q5_referral">
          {(field) => (
            <field.Field>
              <RadioGroup field={field} options={REFERRAL_OPTIONS} />
              <field.Message />
            </field.Field>
          )}
        </form.AppField>
      </QuestionSection>

      <QuestionSection
        number={6}
        title="Anything else you want us to know?"
        optional
      >
        <form.AppField name="q6_freetext">
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
