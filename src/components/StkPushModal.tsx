"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Icon, Money, PrimaryButton } from "./ui";

interface Props {
  invoiceId: string;
  amount: number;
  defaultPhone?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type Stage = "form" | "processing" | "success" | "failed";

export function StkPushModal({ invoiceId, amount, defaultPhone, onClose, onSuccess }: Props) {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function trigger() {
    setError("");
    setStage("processing");
    try {
      const res = await apiPost<{ paymentId: string }>("/api/payments/mpesa", {
        invoiceId,
        phoneNumber: phone,
        amount,
      });
      pollForResult(res.paymentId);
    } catch (e) {
      setError((e as Error).message);
      setStage("failed");
    }
  }

  function pollForResult(paymentId: string) {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await apiGet<{ payment: { status: string; failureReason: string | null } }>(
          `/api/payments/${paymentId}`
        );
        if (res.payment.status === "COMPLETE") {
          clearInterval(pollRef.current!);
          setStage("success");
          onSuccess?.();
        } else if (res.payment.status === "FAILED") {
          clearInterval(pollRef.current!);
          setError(res.payment.failureReason || "Payment failed");
          setStage("failed");
        }
      } catch {
        // keep polling
      }
      if (attempts > 40) {
        clearInterval(pollRef.current!);
        setError("Timed out waiting for confirmation. Check payment history shortly.");
        setStage("failed");
      }
    }, 3000);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[rgba(11,19,43,0.4)] px-4">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-space-md flex flex-col gap-space-md shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm flex items-center gap-2">
            <Icon name="phone_iphone" className="text-secondary" />
            M-Pesa Express (STK Push)
          </span>
          <button onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {stage === "form" && (
          <>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Ingiza nambari yako ya simu upokee ombi la siri la kulipa{" "}
              <Money amount={amount} /> kwenye Safaricom Sim ToolKit.
            </p>
            <div className="flex items-center gap-2 min-h-[52px] rounded-xl border border-outline-variant px-4">
              <span>+254</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="7XX XXX XXX"
                className="flex-1 bg-transparent outline-none"
              />
            </div>
            <PrimaryButton onClick={trigger} disabled={phone.length < 9}>
              <Icon name="send_to_mobile" className="text-[18px]" />
              Tuma Ombi la Malipo (Send Prompt)
            </PrimaryButton>
          </>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Icon name="progress_activity" className="animate-spin text-[36px] text-secondary" />
            <p className="font-label-lg text-label-lg">Inasubiri... Pending STK</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
              Check your phone and enter your M-Pesa PIN to complete payment.
            </p>
          </div>
        )}

        {stage === "success" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Icon name="check_circle" className="text-[36px] text-secondary" />
            <p className="font-label-lg text-label-lg">Imelipwa! Payment received</p>
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </div>
        )}

        {stage === "failed" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Icon name="error" className="text-[36px] text-error" />
            <p className="font-label-lg text-label-lg text-error">{error || "Payment failed"}</p>
            <PrimaryButton onClick={() => setStage("form")}>Try Again</PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}
