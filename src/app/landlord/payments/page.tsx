"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Card,
  Icon,
  Money,
  Pill,
  Spinner,
  ErrorBanner,
  GhostButton,
  ModalShell,
  TextField,
  PrimaryButton,
} from "@/components/ui";
import { StkPushModal } from "@/components/StkPushModal";

interface LeaseSummary {
  id: string;
  unitId: string;
  tenantId: string;
  monthlyRent: number;
  status: string;
}

interface Payment {
  id: string;
  amount: number;
  channel: string;
  status: string;
  createdAt: string;
  failureReason: string | null;
}

export default function PaymentsPage() {
  const [leases, setLeases] = useState<LeaseSummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [stkLeaseId, setStkLeaseId] = useState<string | null>(null);
  const [bankLeaseId, setBankLeaseId] = useState<string | null>(null);

  async function load() {
    try {
      const [leaseRes, dashboardRes] = await Promise.all([
        apiGet<{ leases: LeaseSummary[] }>("/api/leases"),
        apiGet<{ summary: { recentPayments: Payment[] } }>("/api/dashboard"),
      ]);
      setLeases(leaseRes.leases);
      setPayments(dashboardRes.summary.recentPayments);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function exportCsv() {
    const header = "id,amount,channel,status,created_at\n";
    const rows = payments
      .map((p) => `${p.id},${p.amount},${p.channel},${p.status},${p.createdAt}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nyumbaflow-reconciliation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <ErrorBanner message={error} />;
  if (!leases) return <Spinner />;

  const activeLeases = leases.filter((l) => l.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-space-lg px-margin pt-space-md pb-space-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
        <GhostButton onClick={exportCsv} className="w-full">
          <Icon name="file_download" className="text-[18px]" />
          Download Statement (CSV)
        </GhostButton>
      </div>

      <div className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Active Leases</h2>
        {activeLeases.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-lg">
            No active leases yet.
          </Card>
        )}
        {activeLeases.map((l) => (
          <Card key={l.id} className="flex items-center justify-between gap-space-sm">
            <div>
              <p className="font-label-lg text-label-lg font-bold">
                <Money amount={l.monthlyRent} /> /mo
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Lease {l.id.slice(-6)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStkLeaseId(l.id)}
                className="px-3 py-2 rounded-lg bg-secondary-container text-on-secondary-fixed font-label-sm text-label-sm font-bold flex items-center gap-1"
              >
                <Icon name="bolt" className="text-[16px]" />
                STK Push
              </button>
              <button
                onClick={() => setBankLeaseId(l.id)}
                className="px-3 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold flex items-center gap-1"
              >
                <Icon name="account_balance" className="text-[16px]" />
                Bank
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Verified Payment History</h2>
        {payments.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={p.status === "COMPLETE" ? "check_circle" : p.status === "FAILED" ? "error" : "schedule"}
                className={
                  p.status === "COMPLETE"
                    ? "text-secondary"
                    : p.status === "FAILED"
                      ? "text-error"
                      : "text-[#92400E]"
                }
              />
              <div>
                <p className="font-label-md text-label-md font-bold">{p.channel}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-label-lg text-label-lg font-bold">
                <Money amount={p.amount} />
              </span>
              <Pill tone={p.status === "COMPLETE" ? "success" : p.status === "FAILED" ? "error" : "warning"}>
                {p.status}
              </Pill>
            </div>
          </Card>
        ))}
      </div>

      {stkLeaseId && (
        <LeaseStkTrigger leaseId={stkLeaseId} onClose={() => setStkLeaseId(null)} onDone={load} />
      )}
      {bankLeaseId && (
        <BankManualModal leaseId={bankLeaseId} onClose={() => setBankLeaseId(null)} onDone={load} />
      )}
    </div>
  );
}

// Resolves the lease's current invoice, then shows the STK push modal for it.
function LeaseStkTrigger({
  leaseId,
  onClose,
  onDone,
}: {
  leaseId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [invoice, setInvoice] = useState<{ id: string; amountDue: number; amountPaid: number } | null>(
    null
  );
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{
      currentInvoice: { id: string; amountDue: number; amountPaid: number } | null;
      lease: { tenantId: string };
    }>(`/api/leases/${leaseId}`)
      .then(async (res) => {
        if (!res.currentInvoice) {
          setError("No current invoice for this lease");
          return;
        }
        setInvoice(res.currentInvoice);
      })
      .catch((e) => setError((e as Error).message));
  }, [leaseId]);

  if (error) {
    return (
      <ModalShell title="STK Push" onClose={onClose}>
        <ErrorBanner message={error} />
      </ModalShell>
    );
  }

  if (!invoice) {
    return (
      <ModalShell title="STK Push" onClose={onClose}>
        <Spinner />
      </ModalShell>
    );
  }

  if (!phone) {
    return (
      <ModalShell title="Tenant M-Pesa Number" onClose={onClose}>
        <div className="flex flex-col gap-space-md">
          <TextField
            label="Tenant Phone"
            placeholder="07XX XXX XXX"
            onChange={(e) => setPhone(e.target.value)}
          />
          <PrimaryButton onClick={() => setPhone((p) => p || " ")}>Continue</PrimaryButton>
        </div>
      </ModalShell>
    );
  }

  return (
    <StkPushModal
      invoiceId={invoice.id}
      amount={invoice.amountDue - invoice.amountPaid}
      defaultPhone={phone.trim()}
      onClose={onClose}
      onSuccess={onDone}
    />
  );
}

function BankManualModal({
  leaseId,
  onClose,
  onDone,
}: {
  leaseId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ currentInvoice: { id: string; amountDue: number; amountPaid: number } | null }>(
      `/api/leases/${leaseId}`
    ).then((res) => {
      if (res.currentInvoice) {
        setInvoiceId(res.currentInvoice.id);
        setAmount(String(res.currentInvoice.amountDue - res.currentInvoice.amountPaid));
      }
    });
  }, [leaseId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId) return;
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/payments/bank-manual", {
        invoiceId,
        amount: Number(amount),
        reference,
      });
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Confirm Bank Transfer" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Bank/PesaLink transfers are not collectible via IntaSend in real time. Confirm here only
          once you have verified the funds landed in your bank account.
        </p>
        <ErrorBanner message={error} />
        <TextField
          label="Amount Received (KES)"
          type="number"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Bank Reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading || !invoiceId}>
          Confirm Payment Received
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}
