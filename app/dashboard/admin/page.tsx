import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import Link from "next/link";
import {
  Shield,
  Activity,
  Mail,
  ChevronRight,
  Users,
  Zap,
  Send,
} from "@/lib/icons";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from "@/components/ui/item";

// ── Auth ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-xl border">
          <Shield className="size-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold">Administration</h1>
          <p className="text-muted-foreground text-xs">BriefTube · Panneau admin</p>
        </div>
      </div>

      {/* Navigation sections */}
      <div className="flex flex-col gap-4">

        {/* Monitoring & analytics */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            Pilotage
          </p>
          <ItemGroup>
            <Item asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/monitoring">
                <ItemMedia variant="icon">
                  <Activity className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Monitoring</ItemTitle>
                  <ItemDescription>
                    Worker, analytics, funnel d&apos;acquisition, conversion, revenus
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground/40 size-4" />
                </ItemActions>
              </Link>
            </Item>
          </ItemGroup>
        </div>

        {/* Communications */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            Communications
          </p>
          <ItemGroup>
            <Item asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/emails">
                <ItemMedia variant="icon">
                  <Mail className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Emails</ItemTitle>
                  <ItemDescription>
                    Historique des emails envoyés via Resend, statuts, campagnes
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground/40 size-4" />
                </ItemActions>
              </Link>
            </Item>
          </ItemGroup>
        </div>

      </div>
    </div>
  );
}
