"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  Money,
  ModalShell,
  Pill,
  PrimaryButton,
  Spinner,
  TextAreaField,
  SelectField,
} from "@/components/ui";
import { StkPushModal } from "@/components/StkPushModal";

interface Lease {
  id: string;
  status: string;
  monthlyRent: number;
}

interface Unit {
  label: string;
}

interface Property {
  name: string;
}

interface Invoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: string;
}

interface Payment {
  id: string;
  amount: number;
  channel: string;
  status: string;
  createdAt: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface Summary {
  lease: Lease | null;
  unit?: Unit;
  property?: Property;
  invoice: Invoice | null;
  payments: Payment[];
  notices: Notice[];
  tickets: Ticket[];
}

export default function TenantPortalPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [showStk, setShowStk] = useState(false);
  const [showReport, setShowReport] = useState(false);

  async function load() {
    try {
      const res = await apiGet<Summary>("/api/tenant/summary");
      setSummary(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!summary) return <Spinner />;

  if (!summary.lease) {
    return (
      <div className="px-margin">
        <EmptyState
          icon="home"
          title="No active lease yet"
          body="Once your landlord creates a lease for your unit, it will appear here for you to review, sign, and pay your move-in total."
        />
      </div>
    );
  }

  if (summary.lease.status === "PENDING_SIGNATURE") {
    return (
      <div className="px-margin flex flex-col gap-space-md items-center py-space-lg text-center">
        <Icon name="history_edu" className="text-[36px] text-primary-container" />
        <h1 className="font-headline-md text-headline-md">Your lease is ready to sign</h1>
        <p className="text-on-surface-variant">
          Review the lease terms and sign digitally to move forward.
        </p>
        <Link href={`/tenant/lease/${summary.lease.id}/sign`} className="w-full max-w-xs">
          <PrimaryButton className="w-full">Review &amp; Sign Lease</PrimaryButton>
        </Link>
      </div>
    );
  }

  if (summary.lease.status === "PENDING_PAYMENT") {
    return (
      <div className="px-margin flex flex-col gap-space-md items-center py-space-lg text-center">
        <Icon name="account_balance_wallet" className="text-[36px] text-primary-container" />
        <h1 className="font-headline-md text-headline-md">Complete your move-in payment</h1>
        <p className="text-on-surface-variant">
          Your lease is signed. Pay the move-in total via M-Pesa to activate your tenancy and
          receive your keys.
        </p>
        <Link href={`/tenant/lease/${summary.lease.id}/sign`} className="w-full max-w-xs">
          <PrimaryButton className="w-full">Go to Payment</PrimaryButton>
        </Link>
      </div>
    );
  }

  const invoice = summary.invoice;
  const balance = invoice ? invoice.amountDue - invoice.amountPaid : 0;

  return (
    <div className="flex flex-col gap-space-lg px-margin">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Karibu! 👋</h1>
        <p className="flex items-center gap-1 text-on-surface-variant">
          <Icon name="apartment" className="text-[16px]" />
          {summary.property?.name} · {summary.unit?.label}
        </p>
      </div>

      <Card className="flex flex-col gap-space-sm">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
          Hali ya Malipo (Rent Balance)
        </span>
        {balance <= 0 ? (
          <span className="font-headline-sm text-headline-sm text-secondary">Imelipwa Kamili 🎉</span>
        ) : (
          <span className="font-currency-display-mobile text-currency-display-mobile text-error">
            <Money amount={balance} />
          </span>
        )}
        {invoice && (
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Due {new Date(invoice.dueDate).toLocaleDateString()}
          </span>
        )}
        {balance > 0 && (
          <PrimaryButton onClick={() => setShowStk(true)}>
            <Icon name="phone_android" className="text-[18px]" />
            Lipa Mapema / Pay with M-Pesa
          </PrimaryButton>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-space-sm">
        <Card className="flex flex-col items-center gap-1 py-space-md">
          <button onClick={() => setShowReport(true)} className="flex flex-col items-center gap-1">
            <Icon name="build" className="text-primary-container" />
            <span className="font-label-md text-label-md font-bold">Ripoti Tatizo</span>
          </button>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-space-md">
          <span className="font-label-md text-label-md font-bold flex flex-col items-center gap-1">
            <Icon name="receipt_long" className="text-primary-container" />
            {summary.payments.length} Stakabadhi
          </span>
        </Card>
      </div>

      <div className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Historia ya Kodi</h2>
        {summary.payments.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-md">No payments yet.</Card>
        )}
        {summary.payments.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={p.status === "COMPLETE" ? "check_circle" : "schedule"}
                className={p.status === "COMPLETE" ? "text-secondary" : "text-[#92400E]"}
              />
              <div>
                <p className="font-label-md text-label-md font-bold">{p.channel}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="font-label-lg text-label-lg font-bold">
              <Money amount={p.amount} />
            </span>
          </Card>
        ))}
      </div>

      {summary.tickets.length > 0 && (
        <div className="flex flex-col gap-space-sm">
          <h2 className="font-headline-sm text-headline-sm">My Repair Requests</h2>
          {summary.tickets.map((t) => (
            <Card key={t.id} className="flex items-center justify-between">
              <span className="font-label-md text-label-md">{t.title}</span>
              <Pill tone={t.status === "PAID" ? "success" : "neutral"}>{t.status}</Pill>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Ubao wa Matangazo</h2>
        {summary.notices.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-md">No notices yet.</Card>
        )}
        {summary.notices.map((n) => (
          <Card key={n.id} className="flex flex-col gap-1">
            <span className="font-label-md text-label-md font-bold">{n.title}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">{n.body}</span>
          </Card>
        ))}
      </div>

      {showStk && invoice && (
        <StkPushModal
          invoiceId={invoice.id}
          amount={balance}
          onClose={() => setShowStk(false)}
          onSuccess={load}
        />
      )}

      {showReport && (
        <ReportIssueModal onClose={() => setShowReport(false)} onDone={() => { setShowReport(false); load(); }} />
      )}
    </div>
  );
}

function ReportIssueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState("PLUMBING");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/maintenance", { category, title, notes });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Ripoti Tatizo (Report Issue)" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <ErrorBanner message={error} />
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="PLUMBING">Plumbing</option>
          <option value="ELECTRICAL">Electrical</option>
          <option value="CARPENTRY">Carpentry</option>
          <option value="OTHER">Other</option>
        </SelectField>
        <TextAreaField
          label="What's wrong?"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
        />
        <TextAreaField
          label="Additional notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        <PrimaryButton type="submit" disabled={loading}>
          Tuma kwa Caretaker
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}
