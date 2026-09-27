"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { ErrorBanner, ModalShell, PrimaryButton, TextField } from "./ui";

interface Unit {
  id: string;
  label: string;
  targetRent: number;
}

export function NewLeaseModal({
  unit,
  onClose,
  onCreated,
}: {
  unit: Unit;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenantFullName, setTenantFullName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(String(unit.targetRent));
  const [securityDeposit, setSecurityDeposit] = useState(String(unit.targetRent));
  const [serviceCharge, setServiceCharge] = useState("0");
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/leases", {
        unitId: unit.id,
        tenantFullName,
        tenantPhone: normalizePhone(tenantPhone),
        monthlyRent: Number(monthlyRent),
        securityDeposit: Number(securityDeposit),
        serviceCharge: Number(serviceCharge),
        moveInDate,
        leaseTermMonths: 12,
        rentDueDay: 5,
        lateFeePerDay: 500,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`New Lease · ${unit.label}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <ErrorBanner message={error} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          This creates a draft lease and sends the tenant a NyumbaFlow account (if they don&apos;t
          have one) so they can review, sign, and pay the move-in total via IntaSend.
        </p>
        <TextField
          label="Tenant Full Name"
          required
          value={tenantFullName}
          onChange={(e) => setTenantFullName(e.target.value)}
        />
        <TextField
          label="Tenant Phone (M-Pesa)"
          required
          placeholder="07XX XXX XXX"
          value={tenantPhone}
          onChange={(e) => setTenantPhone(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-space-sm">
          <TextField
            label="Monthly Rent"
            type="number"
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
          />
          <TextField
            label="Security Deposit"
            type="number"
            required
            value={securityDeposit}
            onChange={(e) => setSecurityDeposit(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <TextField
            label="Water/Key Fee"
            type="number"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
          />
          <TextField
            label="Move-in Date"
            type="date"
            required
            value={moveInDate}
            onChange={(e) => setMoveInDate(e.target.value)}
          />
        </div>
        <PrimaryButton type="submit" disabled={loading}>
          Create Lease
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}

function normalizePhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return `254${digits}`;
}
