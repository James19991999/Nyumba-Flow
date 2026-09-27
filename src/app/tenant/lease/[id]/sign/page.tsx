"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Card,
  ErrorBanner,
  Icon,
  Money,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  TextField,
} from "@/components/ui";
import { StkPushModal } from "@/components/StkPushModal";

interface Lease {
  id: string;
  status: string;
  monthlyRent: number;
  securityDeposit: number;
  serviceCharge: number;
  moveInDate: string;
  leaseTermMonths: number;
  lateFeePerDay: number;
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
  isMoveInInvoice: number;
}

export default function LeaseSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [lease, setLease] = useState<Lease | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await apiGet<{
        lease: Lease;
        unit: Unit;
        property: Property;
        invoices: Invoice[];
      }>(`/api/leases/${id}`);
      setLease(res.lease);
      setUnit(res.unit);
      setProperty(res.property);
      setInvoices(res.invoices);
      if (res.lease.status === "ACTIVE") {
        router.push(`/inspections/${id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="px-margin"><ErrorBanner message={error} /></div>;
  if (!lease) return <Spinner />;

  const moveInInvoice = invoices.find((i) => i.isMoveInInvoice);

  return (
    <div className="flex flex-col gap-space-lg px-margin">
      <div className="flex items-center gap-2">
        <Link href="/tenant">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="font-headline-sm text-headline-sm">Lease Agreement Signing</h1>
      </div>

      <div className="flex items-center gap-2 text-on-surface-variant">
        <StepDot active={true} label="1. Thibitisha" />
        <StepDot active={lease.status !== "PENDING_SIGNATURE"} label="2. Saini" />
        <StepDot active={lease.status === "ACTIVE"} label="3. Funguo" />
      </div>

      <Card className="flex flex-col gap-space-sm">
        <p className="font-headline-sm text-headline-sm">
          {property?.name} — {unit?.label}
        </p>
        <Row label="Kodi ya Kila Mwezi / Monthly Rent" value={<Money amount={lease.monthlyRent} />} />
        <Row label="Amana ya Usalama / Security Deposit" value={<Money amount={lease.securityDeposit} />} />
        <Row label="Huduma za Pamoja / Service Charge" value={<Money amount={lease.serviceCharge} />} />
        <Row label="Tarehe ya Kuingia / Move-in" value={new Date(lease.moveInDate).toLocaleDateString()} />
        <Row label="Muda wa Upangaji / Lease Term" value={`${lease.leaseTermMonths} Months`} />
        <Row label="Late Fee" value={`KES ${lease.lateFeePerDay}/day after due date`} />
      </Card>

      {lease.status === "PENDING_SIGNATURE" && <SignForm leaseId={id} onSigned={load} />}

      {lease.status === "PENDING_PAYMENT" && moveInInvoice && (
        <MoveInPayment invoice={moveInInvoice} onPaid={load} />
      )}
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1 font-label-sm text-label-sm ${
        active ? "text-secondary font-bold" : ""
      }`}
    >
      <Icon name={active ? "check_circle" : "radio_button_unchecked"} className="text-[16px]" />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant py-2 last:border-0">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <span className="font-label-md text-label-md font-bold">{value}</span>
    </div>
  );
}

function SignForm({ leaseId, onSigned }: { leaseId: string; onSigned: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/leases/${leaseId}/sign`, {
        signatureName: name,
        signatureNationalId: nationalId,
      });
      onSigned();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-space-md">
      <p className="font-label-lg text-label-lg font-bold">Sahihi ya Kidijitali / E-Signature</p>
      <ErrorBanner message={error} />
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <TextField label="Full Legal Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="National ID"
          required
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
        />
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span className="font-body-sm text-body-sm">
            Nimesoma na nimekubaliana na vifungu vyote vya Mkataba wa Upangaji. I have read,
            understood, and accept all clauses under the Kenya Tenancy &amp; Landlord Act.
          </span>
        </label>
        <PrimaryButton type="submit" disabled={!agreed || loading}>
          <Icon name="draw" className="text-[18px]" />
          Sign Lease
        </PrimaryButton>
      </form>
    </Card>
  );
}

function MoveInPayment({
  invoice,
  onPaid,
}: {
  invoice: Invoice;
  onPaid: () => void;
}) {
  const [showStk, setShowStk] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const outstanding = invoice.amountDue - invoice.amountPaid;

  async function payWithCheckout(method: "CARD" | "AIRTEL") {
    setCheckoutError("");
    setRedirecting(true);
    try {
      const res = await apiPost<{ checkoutUrl: string }>("/api/payments/checkout", {
        invoiceId: invoice.id,
        method,
      });
      window.location.href = res.checkoutUrl;
    } catch (e) {
      setCheckoutError((e as Error).message);
      setRedirecting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-space-md">
      <p className="font-label-lg text-label-lg font-bold">
        Jumla ya Kulipa / Total Due: <Money amount={outstanding} />
      </p>
      <ErrorBanner message={checkoutError} />
      <PrimaryButton onClick={() => setShowStk(true)}>
        <Icon name="phone_android" className="text-[18px]" />
        Pay with M-Pesa STK Push
      </PrimaryButton>
      <SecondaryButton onClick={() => payWithCheckout("CARD")} disabled={redirecting}>
        <Icon name="credit_card" className="text-[18px]" />
        Pay with Card (IntaSend)
      </SecondaryButton>
      <SecondaryButton onClick={() => payWithCheckout("AIRTEL")} disabled={redirecting}>
        <Icon name="sim_card" className="text-[18px]" />
        Pay with Airtel Money (IntaSend)
      </SecondaryButton>

      {showStk && (
        <StkPushModal
          invoiceId={invoice.id}
          amount={outstanding}
          onClose={() => setShowStk(false)}
          onSuccess={onPaid}
        />
      )}
    </Card>
  );
}
