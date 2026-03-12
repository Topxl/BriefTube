"use client";

import { cn } from "@/lib/utils";
import { useFormStatus } from "react-dom";
import { Loader } from "../../components/nowts/loader";
import type { ButtonProps } from "../../components/ui/button";
import { Button } from "../../components/ui/button";

export const SubmitButton = (props: ButtonProps) => {
  const { pending } = useFormStatus();

  return (
    <LoadingButton loading={pending} {...props}>
      {props.children}
    </LoadingButton>
  );
};

export const LoadingButton = ({
  loading,
  children,
  className,
  ...props
}: ButtonProps & {
  loading?: boolean;
  success?: string;
}) => {
  return (
    <Button
      {...props}
      disabled={props.disabled ?? loading}
      className={cn(className, "relative")}
    >
      <span
        className={cn(
          "flex items-center gap-1 transition-all duration-200",
          loading ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-200",
          loading ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <Loader size={20} />
      </span>
    </Button>
  );
};
