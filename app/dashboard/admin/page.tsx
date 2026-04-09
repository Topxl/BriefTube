import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import Link from "next/link";
import {
  Shield,
  Activity,
  Mail,
  ChevronRight,
  MessageCircle,
  ListChecks,
  FileText,
} from "@/lib/icons";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
} from "@/components/ui/item";
import { GrantTrialForm } from "@/components/admin/grant-trial-form";

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
          <p className="text-muted-foreground text-xs">
            BriefTube · Panneau admin
          </p>
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
                    Worker, analytics, funnel d&apos;acquisition, conversion,
                    revenus
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground/40 size-4" />
                </ItemActions>
              </Link>
            </Item>
          </ItemGroup>
        </div>

        {/* Support: Léa */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            Support
          </p>
          <ItemGroup>
            <Item asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/support">
                <ItemMedia variant="icon">
                  <MessageCircle className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Léa conversations</ItemTitle>
                  <ItemDescription>
                    User chat inbox, escalations to handle, replies
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground/40 size-4" />
                </ItemActions>
              </Link>
            </Item>
            <Item asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/features">
                <ItemMedia variant="icon">
                  <ListChecks className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Feature requests</ItemTitle>
                  <ItemDescription>
                    Public roadmap, manage suggestions and priorities
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground/40 size-4" />
                </ItemActions>
              </Link>
            </Item>
            <Item asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/knowledge-base">
                <ItemMedia variant="icon">
                  <FileText className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Knowledge base</ItemTitle>
                  <ItemDescription>
                    Articles Léa uses to answer users
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

        {/* Utilisateurs */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground/50 px-1 text-xs font-medium tracking-wide uppercase">
            Utilisateurs
          </p>
          <div className="nm-raised flex flex-col gap-3 rounded-xl px-4 py-3">
            <p className="text-xs font-medium">Offrir un accès Pro</p>
            <GrantTrialForm />
          </div>
        </div>
      </div>
    </div>
  );
}
