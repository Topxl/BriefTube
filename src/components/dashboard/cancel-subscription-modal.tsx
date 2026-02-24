"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Zap } from "@/lib/icons";
import { dialogManager } from "@/features/dialog-manager/dialog-manager";
import { toast } from "sonner";

const CANCELLATION_REASONS = [
  { id: "too_expensive", label: "It's too expensive for my usage" },
  { id: "not_using_enough", label: "I don't listen to summaries often enough" },
  { id: "quality", label: "The summary quality doesn't meet my expectations" },
  { id: "no_telegram", label: "I don't use Telegram enough" },
  {
    id: "few_channels",
    label: "I don't have enough YouTube channels to follow",
  },
  { id: "other_solution", label: "I'm using another solution" },
  { id: "other", label: "Other reason" },
] as const;

type Step = "reasons" | "offer" | "confirmed";

type Props = {
  onClose: () => void;
};

export function CancelSubscriptionModal({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("reasons");
  const [reason, setReason] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const callCancelApi = async (acceptOffer: boolean) => {
    const res = await fetch("/api/stripe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, customMessage, acceptOffer }),
    });
    if (!res.ok) throw new Error("Request failed");
  };

  const handleAcceptOffer = async () => {
    setIsLoading(true);
    try {
      await callCancelApi(true);
      toast.success("Offer applied — thanks for staying with us!");
      onClose();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAnyway = async () => {
    setIsLoading(true);
    try {
      await callCancelApi(false);
      setStep("confirmed");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    router.refresh();
    onClose();
  };

  if (step === "confirmed") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle className="h-6 w-6 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Subscription cancelled</p>
          <p className="text-muted-foreground text-sm">
            Your Pro subscription has been cancelled. You keep access until the
            end of the current billing period.
          </p>
        </div>
        <Button onClick={handleClose} className="w-full">
          Close
        </Button>
      </div>
    );
  }

  if (step === "offer") {
    return (
      <div className="flex flex-col gap-4">
        <div className="nm-raised flex flex-col items-center gap-2 rounded-xl p-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <Zap className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-lg font-semibold">Special offer</p>
          <p className="text-muted-foreground text-sm">
            Before you go, enjoy{" "}
            <span className="text-foreground font-semibold">50% off</span> for
            the next 3 months.
          </p>
          <p className="text-3xl font-bold text-red-400">-50%</p>
          <p className="text-muted-foreground text-xs">for 3 months</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => void handleAcceptOffer()}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-500"
          >
            Claim the offer
          </Button>
          <button
            onClick={() => void handleCancelAnyway()}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground py-1 text-sm transition-colors"
          >
            Cancel anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Help us improve BriefTube. Why do you want to cancel?
      </p>
      <RadioGroup
        value={reason}
        onValueChange={setReason}
        className="flex flex-col gap-2.5"
      >
        {CANCELLATION_REASONS.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5">
            <RadioGroupItem value={r.id} id={r.id} />
            <Label
              htmlFor={r.id}
              className="cursor-pointer text-sm font-normal"
            >
              {r.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <Textarea
        placeholder="Any details? (optional)"
        value={customMessage}
        onChange={(e) => setCustomMessage(e.target.value)}
        className="resize-none text-sm"
        rows={3}
      />
      <Button
        onClick={() => setStep("offer")}
        disabled={!reason}
        variant="destructive"
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}

export function openCancelSubscriptionModal() {
  dialogManager.custom({
    title: "Cancel subscription",
    size: "md",
    children: (
      <CancelSubscriptionModal onClose={() => dialogManager.closeAll()} />
    ),
  });
}
