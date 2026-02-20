import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "@/lib/icons";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isPro = profile?.subscription_status === "active";

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-4">
          Simple pricing. Upgrade or cancel anytime.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Free Plan */}
        <Card className={!isPro ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">5 YouTube channels</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">AI audio summaries</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">Telegram delivery</span>
              </li>
            </ul>
            {!isPro && (
              <Button disabled className="w-full">
                Current Plan
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className={isPro ? "border-primary shadow-lg" : ""}>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <div className="mt-4">
              <span className="text-4xl font-bold">$9</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">Unlimited channels</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">Priority processing</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">Choose your TTS voice</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">No branding</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-4" />
                <span className="text-sm">Early access to features</span>
              </li>
            </ul>
            {isPro ? (
              <Button disabled className="w-full">
                Current Plan
              </Button>
            ) : (
              <form
                action="/api/stripe/checkout"
                method="POST"
                data-form-type="other"
                suppressHydrationWarning
              >
                <Button type="submit" className="w-full">
                  Upgrade to Pro
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
