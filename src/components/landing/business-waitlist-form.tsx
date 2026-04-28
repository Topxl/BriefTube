"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, Form } from "@/features/form/tanstack-form";
import { capture } from "@/lib/posthog/client";
import { CheckCircle } from "@/lib/icons";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Required").max(120),
  role: z.string().min(1, "Required").max(80),
  teamSize: z.string().optional(),
  channels: z.string().min(3, "Add at least one channel").max(2000, "Too long"),
  useCase: z.string().max(2000).optional(),
});

type Values = z.infer<typeof schema>;

export function BusinessWaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    schema,
    defaultValues: {
      email: "",
      company: "",
      role: "",
      teamSize: "",
      channels: "",
      useCase: "",
    } satisfies Values,
    onSubmit: async (values) => {
      setErrorMsg(null);
      capture("business_waitlist_submit_attempt", {
        company: values.company,
        role: values.role,
      });

      const res = await fetch("/api/business-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        const msg = data?.error ?? "Something went wrong. Try again.";
        setErrorMsg(msg);
        capture("business_waitlist_submit_error", { error: msg });
        throw new Error(msg);
      }

      capture("business_waitlist_submit_success", {
        company: values.company,
        role: values.role,
      });
      setSubmitted(true);
    },
  });

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
        <CheckCircle className="mx-auto h-8 w-8 text-emerald-400" />
        <h3 className="mt-3 text-lg font-semibold">You&apos;re on the list.</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          We&apos;ll send you the first audio brief within a week — manually
          curated. No payment until you say it&apos;s worth it.
        </p>
      </div>
    );
  }

  return (
    <Form form={form} className="flex flex-col gap-4">
      <form.AppField name="email">
        {(field) => (
          <field.Field>
            <field.Label>Work email</field.Label>
            <field.Content>
              <field.Input
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
              />
              <field.Message />
            </field.Content>
          </field.Field>
        )}
      </form.AppField>

      <div className="grid gap-4 md:grid-cols-2">
        <form.AppField name="company">
          {(field) => (
            <field.Field>
              <field.Label>Company</field.Label>
              <field.Content>
                <field.Input placeholder="Acme Inc." />
                <field.Message />
              </field.Content>
            </field.Field>
          )}
        </form.AppField>

        <form.AppField name="role">
          {(field) => (
            <field.Field>
              <field.Label>Your role</field.Label>
              <field.Content>
                <field.Input placeholder="Founder, PMM, Sales…" />
                <field.Message />
              </field.Content>
            </field.Field>
          )}
        </form.AppField>
      </div>

      <form.AppField name="channels">
        {(field) => (
          <field.Field>
            <field.Label>3 YouTube channels you want to monitor</field.Label>
            <field.Content>
              <field.Textarea
                placeholder={
                  "https://youtube.com/@competitor1\nhttps://youtube.com/@competitor2\nhttps://youtube.com/@industryleader"
                }
                rows={4}
              />
              <field.Description>
                Paste channel URLs or names — one per line.
              </field.Description>
              <field.Message />
            </field.Content>
          </field.Field>
        )}
      </form.AppField>

      <form.AppField name="useCase">
        {(field) => (
          <field.Field>
            <field.Label>What would you use this for? (optional)</field.Label>
            <field.Content>
              <field.Textarea
                placeholder="Competitor monitoring, sales enablement, industry watch…"
                rows={2}
              />
              <field.Message />
            </field.Content>
          </field.Field>
        )}
      </form.AppField>

      {errorMsg ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMsg}
        </p>
      ) : null}

      <form.SubmitButton className="bg-red-600 hover:bg-red-500">
        Join the waitlist
      </form.SubmitButton>

      <p className="text-muted-foreground text-center text-xs">
        Limited beta. We&apos;ll send the first audio brief manually before any
        billing.
      </p>
    </Form>
  );
}
