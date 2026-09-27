"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { Card, Icon, Money, Pill, Spinner, ErrorBanner } from "@/components/ui";
import { StkPushModal } from "@/components/StkPushModal";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";

interface Arrear {
  tenantId: string;
  leaseId: string;
  unitLabel: string;
  propertyName: string;
  amount: number;
  invoiceId: string;
  phone: string;
}

interface Payment {
  id: string;
  amount: number;
  channel: string;
  status: string;
  createdAt: string;
}

interface Summary {
  totalUnits: number;
  occupiedUnits: number;
  monthlyTarget: number;
  monthlyCollected: number;
  arrears: Arrear[];
  openMaintenanceCount: number;
  recentPayments: Payment[];
  properties: Array<{
    id: string;
    name: string;
    location: string;
    units: Array<{ id: string; status: string }>;
  }>;
}

export default function LandlordDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [modalArrear, setModalArrear] = useState<Arrear | null>(null);
  const { t } = useLanguage();

  async function load() {
    try {
      const res = await apiGet<{ summary: Summary }>("/api/dashboard");
      setSummary(res.summary);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!summary) return <Spinner />;

  const pct =
    summary.monthlyTarget > 0
      ? Math.min(100, (summary.monthlyCollected / summary.monthlyTarget) * 100)
      : 0;
  const balance = summary.monthlyTarget - summary.monthlyCollected;

  return (
    <div className="flex flex-col gap-space-lg px-margin pt-space-md pb-space-lg">
      {/* Cashflow overview */}
      <div className="relative overflow-hidden bg-primary-container text-surface-container-lowest rounded-2xl p-space-md shadow-xl">
        <div className="relative z-10 flex flex-col gap-space-md">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-secondary-fixed tracking-wider uppercase">
                Mapato ya Kodi · Monthly Inflow
              </span>
              <div className="flex items-baseline gap-space-xs mt-0.5">
                <span className="font-currency-display-mobile text-currency-display-mobile">
                  <Money amount={summary.monthlyCollected} />
                </span>
                <span className="font-label-sm text-label-sm text-on-primary-container">
                  / {Math.round(summary.monthlyTarget).toLocaleString("en-KE")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary-container/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
              <span className="font-label-sm text-label-sm text-secondary-fixed font-bold">
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="w-full bg-surface-container-highest/20 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-secondary to-secondary-container h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-on-primary-container">
              <span className="font-label-sm text-[11px]">Lengo la Mwezi (Target)</span>
              <span className="font-label-sm text-[11px] text-surface-container-lowest font-medium">
                Baki: <Money amount={Math.max(balance, 0)} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-space-sm">
        <Card className="flex flex-col gap-1">
          <Icon name="group" className="text-primary-container" />
          <span className="font-headline-sm text-headline-sm">
            {summary.occupiedUnits}/{summary.totalUnits}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Idadi ya Wapangaji
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <Icon name="handyman" className="text-error" />
          <span className="font-headline-sm text-headline-sm">{summary.openMaintenanceCount}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Matengenezo Wazi
          </span>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-space-sm">
        <Link href="/landlord/properties">
          <Card className="flex flex-col items-center gap-1 py-space-lg">
            <Icon name="add_home_work" className="text-primary-container" />
            <span className="font-label-md text-label-md font-bold text-center">
              Ongeza Nyumba / Property
            </span>
          </Card>
        </Link>
        <Link href="/landlord/maintenance">
          <Card className="flex flex-col items-center gap-1 py-space-lg">
            <Icon name="build" className="text-primary-container" />
            <span className="font-label-md text-label-md font-bold text-center">
              Matengenezo / Repairs
            </span>
          </Card>
        </Link>
      </div>

      {/* Arrears */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            <h2 className="font-headline-sm text-headline-sm">{t("arrears")}</h2>
          </div>
          {summary.arrears.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
              {summary.arrears.length} Wapangaji
            </span>
          )}
        </div>

        {summary.arrears.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-lg">
            <Icon name="celebration" className="text-[28px] mb-1" />
            <p className="font-label-md text-label-md">{t("no_arrears")}</p>
          </Card>
        )}

        {summary.arrears.map((a) => (
          <Card key={a.invoiceId} className="flex flex-col gap-space-sm">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg font-bold">{a.propertyName}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Unit {a.unitLabel}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-label-lg text-label-lg text-error font-bold">
                  <Money amount={a.amount} />
                </span>
                <Pill tone="error">Deni</Pill>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModalArrear(a)}
                className="min-h-[44px] bg-secondary-container text-on-secondary-fixed font-label-md text-label-md rounded-lg flex items-center justify-center gap-1.5 font-bold"
              >
                <Icon name="tap_and_play" className="text-[18px]" />
                1-Tap STK Push
              </button>
              <a
                href={`tel:+${a.phone}`}
                className="min-h-[44px] bg-surface-container-high text-on-surface font-label-md text-label-md rounded-lg flex items-center justify-center gap-1.5 font-bold"
              >
                <Icon name="call" className="text-[18px]" />
                Call Tenant
              </a>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent settlements */}
      <div className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Live Settlements · Miamala</h2>
        {summary.recentPayments.length === 0 && (
          <Card className="text-center text-on-surface-variant py-space-lg">
            No payments recorded yet.
          </Card>
        )}
        {summary.recentPayments.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon
                name={p.status === "COMPLETE" ? "check_circle" : "schedule"}
                className={p.status === "COMPLETE" ? "text-secondary" : "text-[#92400E]"}
              />
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold">{p.channel}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <span className="font-label-lg text-label-lg font-bold">
              <Money amount={p.amount} />
            </span>
          </Card>
        ))}
      </div>

      {modalArrear && (
        <StkPushModal
          invoiceId={modalArrear.invoiceId}
          amount={modalArrear.amount}
          defaultPhone={modalArrear.phone.replace(/^254/, "")}
          onClose={() => setModalArrear(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
