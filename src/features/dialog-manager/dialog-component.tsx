"use client";

import { Typography } from "@/components/nowts/typography";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LoadingButton } from "../form/submit-button";
import { handleDialogAction, useDialogStore } from "./dialog-store";
import type { Dialog } from "./dialog-types";

export function DialogComponent(props: { dialog: Dialog }) {
  const { dialog } = props;
  const [confirmText, setConfirmText] = useState("");
  const [inputValue, setInputValue] = useState(
    dialog.type === "input" ? (dialog.input.defaultValue ?? "") : "",
  );

  if (dialog.type === "custom") {
    return (
      <AlertDialog open={true}>
        <AlertDialogContent>{dialog.children}</AlertDialogContent>
      </AlertDialog>
    );
  }

  const isConfirmDisabled =
    dialog.type === "confirm" && dialog.confirmText
      ? confirmText !== dialog.confirmText
      : false;

  const handleAction = async () => {
    await handleDialogAction(dialog.id, async () =>
      dialog.action.onClick?.(dialog.type === "input" ? inputValue : undefined),
    );
  };

  const handleCancel = async () => {
    if (dialog.cancel?.onClick) {
      await dialog.cancel.onClick();
    } else {
      useDialogStore.getState().removeDialog(dialog.id);
    }
  };

  return (
    <AlertDialog open={true} onOpenChange={handleCancel}>
      <AlertDialogContent>
        <AlertDialogHeader
          className={cn({
            "flex flex-col items-center gap-2": dialog.style === "centered",
          })}
        >
          {dialog.icon && (
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <dialog.icon className="size-6" />
            </div>
          )}
          <AlertDialogTitle>{dialog.title ?? ""}</AlertDialogTitle>
          {typeof dialog.description === "string" ? (
            <AlertDialogDescription>
              {dialog.description}
            </AlertDialogDescription>
          ) : (
            dialog.description
          )}
        </AlertDialogHeader>

        {dialog.type === "confirm" && dialog.confirmText && (
          <div className="space-y-2">
            <Typography>
              Type <Typography variant="code">{dialog.confirmText}</Typography>{" "}
              to confirm this action.
            </Typography>
            <Input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (!dialog.loading && !isConfirmDisabled) {
                    void handleAction();
                  }
                }
              }}
            />
          </div>
        )}

        {dialog.type === "input" && (
          <div className="mt-1 space-y-1.5">
            <Label className="text-muted-foreground text-xs font-medium">
              {dialog.input.label}
            </Label>
            <Input
              value={inputValue}
              placeholder={dialog.input.placeholder}
              onChange={(e) => setInputValue(e.target.value)}
              ref={(ref) => ref?.focus()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!dialog.loading && !isConfirmDisabled) {
                    void handleAction();
                  }
                }
              }}
            />
          </div>
        )}

        <AlertDialogFooter>
          {/* Action en premier dans le DOM = en haut (mobile) / à droite (desktop sm:flex-row-reverse) */}
          <LoadingButton
            loading={dialog.loading}
            disabled={dialog.loading || isConfirmDisabled}
            onClick={handleAction}
            variant={dialog.action.variant ?? "default"}
            className={cn(
              "w-full sm:w-auto",
              (!dialog.action.variant || dialog.action.variant === "default") &&
                "border-transparent bg-red-600 text-white shadow-[0_0_16px_rgba(239,68,68,0.2)] hover:bg-red-500",
            )}
          >
            {dialog.action.label ?? "OK"}
          </LoadingButton>

          <Button
            variant="outline"
            disabled={dialog.loading}
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {dialog.cancel?.label ?? "Cancel"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
