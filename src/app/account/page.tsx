"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { Card, ErrorBanner, Icon, PrimaryButton, GhostButton } from "@/components/ui";

export default function AccountPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function downloadExport() {
    window.open("/api/account/export", "_blank");
  }

  async function deleteAccount() {
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/account/delete");
      router.push("/login");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-surface">
      <header className="flex items-center gap-2 px-margin pt-safe h-16">
        <Link href="/">
          <Icon name="arrow_back" />
        </Link>
        <span className="font-headline-sm text-headline-sm">Account &amp; Privacy</span>
      </header>
      <main className="flex-1 flex flex-col px-margin py-space-lg max-w-md w-full mx-auto gap-space-lg">
        <ErrorBanner message={error} />

        <Card className="flex flex-col gap-space-sm">
          <p className="font-label-lg text-label-lg font-bold flex items-center gap-2">
            <Icon name="download" className="text-[18px]" />
            Export My Data
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Download everything NyumbaFlow holds about you — profile, leases, payments and
            maintenance history — as a JSON file, in line with the Kenya Data Protection Act (2019).
          </p>
          <GhostButton onClick={downloadExport}>Download My Data</GhostButton>
        </Card>

        <Card className="flex flex-col gap-space-sm border-2 border-error-container">
          <p className="font-label-lg text-label-lg font-bold flex items-center gap-2 text-error">
            <Icon name="delete_forever" className="text-[18px]" />
            Delete My Account
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            This removes your personal details (name, email, phone, ID) from NyumbaFlow. Financial
            and lease records tied to an active tenancy are kept in anonymized form, as required for
            audit and for the other party to your tenancy.
          </p>
          {!confirming ? (
            <GhostButton onClick={() => setConfirming(true)}>Request Account Deletion</GhostButton>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-label-md text-label-md text-error">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <PrimaryButton onClick={deleteAccount} disabled={loading} className="!bg-error">
                  Yes, Delete
                </PrimaryButton>
                <GhostButton onClick={() => setConfirming(false)}>Cancel</GhostButton>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
