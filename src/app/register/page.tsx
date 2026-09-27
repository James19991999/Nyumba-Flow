"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import {
  Icon,
  PrimaryButton,
  TextField,
  ErrorBanner,
} from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"LANDLORD" | "TENANT">("LANDLORD");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/register", {
        role,
        fullName,
        phone: normalizePhone(phone),
        email: email || undefined,
        password,
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
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
        <span className="font-headline-sm text-headline-sm">Jisajili / Create Account</span>
      </header>
      <main className="flex-1 flex flex-col px-margin py-space-lg max-w-md w-full mx-auto gap-space-lg">
        <ErrorBanner message={error} />
        <form onSubmit={submit} className="flex flex-col gap-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <button
              type="button"
              onClick={() => setRole("LANDLORD")}
              className={`rounded-xl p-space-md flex flex-col items-center gap-1 border-2 ${
                role === "LANDLORD"
                  ? "border-primary-container bg-primary-container text-surface-container-lowest"
                  : "border-outline-variant"
              }`}
            >
              <Icon name="apartment" />
              <span className="font-label-md text-label-md font-bold">Mwenye Nyumba</span>
              <span className="font-label-sm text-label-sm opacity-80">Landlord</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("TENANT")}
              className={`rounded-xl p-space-md flex flex-col items-center gap-1 border-2 ${
                role === "TENANT"
                  ? "border-primary-container bg-primary-container text-surface-container-lowest"
                  : "border-outline-variant"
              }`}
            >
              <Icon name="vpn_key" />
              <span className="font-label-md text-label-md font-bold">Mpangaji</span>
              <span className="font-label-sm text-label-sm opacity-80">Tenant</span>
            </button>
          </div>

          <TextField
            label="Full Legal Name"
            swLabel="Jina Kamili"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Phone Number (M-Pesa)"
            swLabel="Nambari ya Simu"
            required
            placeholder="07XX XXX XXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            swLabel="Nenosiri"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <PrimaryButton type="submit" disabled={loading}>
            <Icon name="add_circle" className="text-[18px]" />
            Create Account
          </PrimaryButton>
        </form>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-container font-bold underline">
            Sign in
          </Link>
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
