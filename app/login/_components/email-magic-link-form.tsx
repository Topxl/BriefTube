"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/locales";

const tl = t.auth.login;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailMagicLinkForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMessage(tl.magicLink.errorInvalidEmail);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          // Magic links land on /auth/callback which already handles
          // exchangeCodeForSession + new-user trial provisioning.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSentTo(trimmed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : tl.magicLink.errorGeneric,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-white/[0.14] bg-white/[0.04] p-4 text-center"
      >
        <p className="text-sm font-medium">{tl.magicLink.sentHeading}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {tl.magicLink.sentBody(sentTo)}
        </p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setEmail("");
          }}
          className="text-muted-foreground hover:text-foreground mt-3 text-xs underline underline-offset-2"
        >
          {tl.magicLink.useDifferentEmail}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder={tl.magicLink.emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? "magic-link-error" : undefined}
      />
      {errorMessage && (
        <p id="magic-link-error" className="text-destructive text-xs">
          {errorMessage}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        disabled={isLoading || email.trim().length === 0}
        className="w-full"
      >
        {isLoading ? tl.magicLink.submittingLabel : tl.magicLink.submitLabel}
      </Button>
    </form>
  );
}
