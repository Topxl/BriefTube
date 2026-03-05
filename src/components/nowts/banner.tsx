import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "@/lib/icons";

type BannerVariant = "warning" | "danger" | "info" | "success";

type BannerAction = {
  label: string;
  loading?: boolean;
} & (
  | { onClick: () => void; href?: never }
  | { href: string; onClick?: never }
);

type BannerProps = {
  variant: BannerVariant;
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: BannerAction;
  onDismiss?: () => void;
};

const variantStyles = {
  warning: {
    bg: "bg-amber-500/[0.05]",
    titleColor: "text-amber-300/90",
    actionClassName:
      "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300",
  },
  danger: {
    bg: "bg-red-500/[0.08]",
    titleColor: "text-red-400/90",
    actionClassName: "text-red-400/80 hover:bg-red-500/10 hover:text-red-300",
  },
  info: {
    bg: "bg-blue-500/[0.06]",
    titleColor: "text-blue-300/90",
    actionClassName:
      "text-blue-400/80 hover:bg-blue-500/10 hover:text-blue-300",
  },
  success: {
    bg: "bg-emerald-500/[0.06]",
    titleColor: "text-emerald-300/90",
    actionClassName:
      "text-emerald-400/80 hover:bg-emerald-500/10 hover:text-emerald-300",
  },
} satisfies Record<
  BannerVariant,
  { bg: string; titleColor: string; actionClassName: string }
>;

export function Banner({
  variant,
  icon,
  title,
  description,
  action,
  onDismiss,
}: BannerProps) {
  const { bg, titleColor, actionClassName } = variantStyles[variant];

  return (
    <div
      className={`nm-raised flex items-center gap-2 rounded-2xl py-1.5 pr-1 pl-3 ${bg}`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        {description ? (
          <div className="flex flex-col">
            <span className={`text-xs font-medium ${titleColor}`}>{title}</span>
            <span className="text-muted-foreground text-[10px]">
              {description}
            </span>
          </div>
        ) : (
          <span className={`truncate text-xs font-medium ${titleColor}`}>
            {title}
          </span>
        )}
      </div>
      {action &&
        ("href" in action && action.href ? (
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 shrink-0 px-2 text-xs ${actionClassName}`}
            asChild
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 shrink-0 px-2 text-xs ${actionClassName}`}
            onClick={"onClick" in action ? action.onClick : undefined}
            disabled={action.loading}
          >
            {action.label}
          </Button>
        ))}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-muted-foreground/30 hover:text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-white/[0.06]"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
