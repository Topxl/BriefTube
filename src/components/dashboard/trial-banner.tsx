import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/[0.15] bg-amber-500/[0.04] py-2.5 pr-2 pl-3.5">
      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
      <p className="text-muted-foreground min-w-0 flex-1 text-xs">
        <span className="font-medium text-amber-300/90">
          {daysLeft === 1 ? "Dernier jour" : `${daysLeft} jours`}
        </span>{" "}
        restants dans ta période Pro &middot; Chaînes illimitées, voix TTS,
        traitement prioritaire
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-2.5 text-xs text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
        asChild
      >
        <Link href="/dashboard/billing">Passer en Pro</Link>
      </Button>
    </div>
  );
}
