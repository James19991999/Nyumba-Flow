"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { Icon, PrimaryButton, GhostButton, ErrorBanner } from "@/components/ui";

type Mode = "otp-phone" | "otp-code" | "password";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("otp-phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function requestOtp() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/otp/request", { phone: normalizePhone(phone) });
      setInfo("Tumekutumia OTP — check your SMS for a 6-digit code.");
      setMode("otp-code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/otp/verify", { phone: normalizePhone(phone), code });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loginPassword() {
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { identifier, password });
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
      <header className="flex items-center justify-between px-margin pt-safe h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-surface-container-lowest">
            <Icon name="apartment" />
          </div>
          <span className="font-headline-sm text-headline-sm">NyumbaFlow</span>
        </div>
        <span className="flex items-center gap-1 font-label-sm text-label-sm text-secondary">
          <Icon name="verified_user" className="text-[16px]" />
          Salama · Safaricom &amp; Bank Rails Live
        </span>
      </header>

      <main className="flex-1 flex flex-col justify-center px-margin py-space-lg max-w-md w-full mx-auto gap-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Karibu Tena</h1>
          <p className="text-on-surface-variant">
            Welcome back. Manage properties, rent and tenancies seamlessly.
          </p>
        </div>

        <ErrorBanner message={error} />
        {info && !error && (
          <div className="rounded-xl bg-[#ECFDF5] text-[#065F46] px-4 py-3 font-label-md text-label-md">
            {info}
          </div>
        )}

        {mode !== "password" && (
          <div className="flex flex-col gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Nambari ya Simu (M-Pesa ID) · STK Ready
              </span>
              <div className="flex items-center gap-2 min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4">
                <span>🇰🇪 +254</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="7XX XXX XXX"
                  disabled={mode === "otp-code"}
                  className="flex-1 bg-transparent outline-none"
                />
              </div>
            </label>

            {mode === "otp-code" && (
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Enter OTP
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  placeholder="••••••"
                  className="min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4 tracking-[0.5em] text-center font-headline-sm"
                />
              </label>
            )}

            {mode === "otp-phone" ? (
              <PrimaryButton onClick={requestOtp} disabled={loading || phone.length < 9}>
                <Icon name="sms" className="text-[18px]" />
                Tuma OTP / Continue with M-Pesa
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={verifyOtp} disabled={loading || code.length < 6}>
                <Icon name="arrow_forward" className="text-[18px]" />
                Verify &amp; Continue
              </PrimaryButton>
            )}

            <button
              onClick={() => setMode("password")}
              className="text-center font-label-md text-label-md text-primary-container underline"
              type="button"
            >
              Use Email &amp; Password badala yake
            </button>
          </div>
        )}

        {mode === "password" && (
          <div className="flex flex-col gap-space-md">
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Barua Pepe au Simu / Email or Phone
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Nenosiri / Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4"
              />
            </label>
            <PrimaryButton onClick={loginPassword} disabled={loading}>
              <Icon name="lock_open" className="text-[18px]" />
              Ingia / Sign In
            </PrimaryButton>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode("otp-phone")}
                className="font-label-sm text-label-sm text-primary-container underline"
                type="button"
              >
                Use M-Pesa phone &amp; OTP instead
              </button>
              <Link
                href="/reset-password"
                className="font-label-sm text-label-sm text-primary-container underline"
              >
                Umesahau? Forgot password
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 pt-space-md border-t border-outline-variant">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Huna akaunti ya NyumbaFlow?
          </span>
          <Link href="/register" className="w-full">
            <GhostButton className="w-full">
              <Icon name="add_circle" className="text-[18px]" />
              Jisajili kama Mwenye Nyumba au Mpangaji
            </GhostButton>
          </Link>
        </div>

        <p className="text-center font-label-sm text-label-sm text-on-surface-variant flex items-center justify-center gap-1">
          <Icon name="verified_user" className="text-[14px]" />
          256-bit Encrypted · Kenya Data Protection Act 2019 Compliant
        </p>
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
