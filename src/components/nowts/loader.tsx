import { cn } from "@/lib/utils";
import type { LucideProps } from "@/lib/icons";
import { Loader2 } from "@/lib/icons";

export const Loader = ({ className, ...props }: LucideProps) => {
  return <Loader2 {...props} className={cn(className, "animate-spin")} />;
};
