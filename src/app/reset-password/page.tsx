"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { Icon, PrimaryButton, TextField, ErrorBanner } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestReset() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/password-reset/request", { phone: normalizePhone(phone) });
      setInfo("If that number has an account, a reset code has been sent via SMS.");
      setStage("confirm");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/password-reset/confirm", {
        phone: normalizePhone(phone),
        code,
        newPassword,
      });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-surface">
      <header className="flex items-center gap-2 px-margin pt-safe h-16">
        <Link href="/login">
          <Icon name="arrow_back" />
        </Link>
        <span className="font-headline-sm text-headline-sm">Reset Password</span>
      </header>
      <main className="flex-1 flex flex-col px-margin py-space-lg max-w-md w-full mx-auto gap-space-md">
        <ErrorBanner message={error} />
        {info && !error && (
          <div className="rounded-xl bg-[#ECFDF5] text-[#065F46] px-4 py-3 font-label-md text-label-md">
            {info}
          </div>
        )}

        <TextField
          label="Phone Number"
          placeholder="07XX XXX XXX"
          value={phone}
          disabled={stage === "confirm"}
          onChange={(e) => setPhone(e.target.value)}
        />

        {stage === "request" ? (
          <PrimaryButton onClick={requestReset} disabled={loading || phone.length < 9}>
            Send Reset Code
          </PrimaryButton>
        ) : (
          <>
            <TextField label="6-digit Code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <TextField
              label="New Password"
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PrimaryButton onClick={confirmReset} disabled={loading || code.length < 6 || newPassword.length < 6}>
              Set New Password
            </PrimaryButton>
          </>
        )}
      </main>
    </div>
  );
}

function normalizePhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return `254${digits}`;
}
