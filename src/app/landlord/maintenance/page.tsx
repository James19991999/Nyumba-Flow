"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";
import { Card, Icon, Money, Pill, Spinner, ErrorBanner, ModalShell, TextField, PrimaryButton } from "@/components/ui";

interface Ticket {
  id: string;
  category: string;
  title: string;
  notes: string | null;
  priority: "URGENT" | "NORMAL";
  status: "REPORTED" | "ASSIGNED" | "QUOTED" | "REPAIRED" | "PAID";
  contractorName: string | null;
  contractorPhone: string | null;
  quoteAmount: number | null;
  quoteApproved: number;
  createdAt: string;
}

const STEPS = ["REPORTED", "ASSIGNED", "QUOTED", "REPAIRED", "PAID"] as const;

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Ticket | null>(null);

  async function load() {
    try {
      const res = await apiGet<{ tickets: Ticket[] }>("/api/maintenance");
      setTickets(res.tickets);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!tickets) return <Spinner />;

  const open = tickets.filter((t) => t.status !== "PAID");
  const resolved = tickets.filter((t) => t.status === "PAID");

  return (
    <div className="flex flex-col gap-space-lg px-margin pt-space-md pb-space-lg">
      <div className="grid grid-cols-2 gap-space-sm">
        <Card className="flex flex-col gap-1">
          <span className="font-headline-sm text-headline-sm">{open.length}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Open Tickets</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="font-headline-sm text-headline-sm">{resolved.length}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Resolved</span>
        </Card>
      </div>

      <div className="flex flex-col gap-space-sm">
        {tickets.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-lg">
            No maintenance tickets yet.
          </Card>
        )}
        {tickets.map((t) => (
          <Card key={t.id} className="flex flex-col gap-space-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {t.priority === "URGENT" && <Pill tone="error">Urgent</Pill>}
                  <span className="font-label-lg text-label-lg font-bold">{t.title}</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{t.category}</p>
              </div>
              <Pill tone={t.status === "PAID" ? "success" : "neutral"}>{t.status}</Pill>
            </div>
            {t.notes && <p className="font-body-sm text-body-sm">{t.notes}</p>}

            <div className="flex items-center gap-1 text-on-surface-variant">
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      STEPS.indexOf(t.status) >= i ? "bg-secondary" : "bg-outline-variant"
                    }`}
                  />
                  {i < STEPS.length - 1 && <span className="w-4 h-px bg-outline-variant" />}
                </div>
              ))}
            </div>

            {t.quoteAmount && (
              <p className="font-label-md text-label-md">
                Quote: <Money amount={t.quoteAmount} />{" "}
                {t.quoteApproved ? <Pill tone="success">Approved</Pill> : <Pill tone="warning">Pending</Pill>}
              </p>
            )}

            <button
              onClick={() => setEditing(t)}
              className="self-start px-3 py-1.5 rounded-lg bg-surface-container-high font-label-sm text-label-sm font-bold flex items-center gap-1"
            >
              <Icon name="edit" className="text-[16px]" />
              Manage Ticket
            </button>
          </Card>
        ))}
      </div>

      {editing && (
        <ManageTicketModal
          ticket={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ManageTicketModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: Ticket;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [contractorName, setContractorName] = useState(ticket.contractorName || "");
  const [contractorPhone, setContractorPhone] = useState(ticket.contractorPhone || "");
  const [quoteAmount, setQuoteAmount] = useState(ticket.quoteAmount ? String(ticket.quoteAmount) : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPatch(`/api/maintenance/${ticket.id}`, {
        status,
        contractorName: contractorName || undefined,
        contractorPhone: contractorPhone || undefined,
        quoteAmount: quoteAmount ? Number(quoteAmount) : undefined,
        quoteApproved: status === "REPAIRED" || status === "PAID" ? true : undefined,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Manage Ticket" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <ErrorBanner message={error} />
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface-variant">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Ticket["status"])}
            className="min-h-[52px] rounded-xl border border-outline-variant px-4"
          >
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Contractor Name" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
        <TextField label="Contractor Phone" value={contractorPhone} onChange={(e) => setContractorPhone(e.target.value)} />
        <TextField label="Quote Amount (KES)" type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
        <PrimaryButton type="submit" disabled={loading}>
          Save
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}
