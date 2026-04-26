"use client";

import dynamic from "next/dynamic";
import { useDialogStore } from "./dialog-store";

// DialogComponent pulls Dialog + AlertDialog + Input + Label + LoadingButton.
// Lazy-load it so its bundle never ships on routes that never open a dialog
// (the public landing page is the prime example).
const DialogComponent = dynamic(
  async () =>
    import("./dialog-component").then((m) => ({ default: m.DialogComponent })),
  { ssr: false, loading: () => null },
);

export function DialogManagerRenderer() {
  const activeDialog = useDialogStore((state) => state.activeDialog);

  if (activeDialog) {
    return <DialogComponent dialog={activeDialog} />;
  }

  return null;
}
