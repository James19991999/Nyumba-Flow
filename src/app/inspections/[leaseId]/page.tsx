"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Card,
  ErrorBanner,
  Icon,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  TextField,
} from "@/components/ui";

interface Me {
  id: string;
  role: string;
  fullName: string;
}

interface Room {
  name: string;
  condition: string;
  notes: string;
  photos: number;
}

interface Inspection {
  id: string;
  kplcMeterReading: number | null;
  kplcMeterNumber: string | null;
  waterMeterReading: number | null;
  waterMeterNumber: string | null;
  roomsJson: string;
  tenantSignedOff: number;
  caretakerSignedOff: number;
  keysHandedOver: number;
}

const DEFAULT_ROOMS: Room[] = [
  { name: "Living Area / Sebule", condition: "Not yet checked", notes: "", photos: 0 },
  { name: "Master Bedroom", condition: "Not yet checked", notes: "", photos: 0 },
  { name: "Kitchen & Pantry", condition: "Not yet checked", notes: "", photos: 0 },
  { name: "Bathroom", condition: "Not yet checked", notes: "", photos: 0 },
];

export default function InspectionPage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}) {
  const { leaseId } = usePromise(params);
  const [me, setMe] = useState<Me | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [kplcReading, setKplcReading] = useState("");
  const [kplcNumber, setKplcNumber] = useState("");
  const [waterReading, setWaterReading] = useState("");
  const [waterNumber, setWaterNumber] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [meRes, inspRes] = await Promise.all([
        apiGet<{ user: Me }>("/api/auth/me"),
        apiGet<{ inspection: Inspection | null }>(`/api/inspections/${leaseId}`),
      ]);
      setMe(meRes.user);
      if (inspRes.inspection) {
        setInspection(inspRes.inspection);
        setRooms(JSON.parse(inspRes.inspection.roomsJson || "[]") || DEFAULT_ROOMS);
        setKplcReading(String(inspRes.inspection.kplcMeterReading ?? ""));
        setKplcNumber(inspRes.inspection.kplcMeterNumber ?? "");
        setWaterReading(String(inspRes.inspection.waterMeterReading ?? ""));
        setWaterNumber(inspRes.inspection.waterMeterNumber ?? "");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  if (error) return <div className="px-margin py-space-lg"><ErrorBanner message={error} /></div>;
  if (!me) return <Spinner />;

  const canEdit = me.role === "LANDLORD" || me.role === "CARETAKER";

  async function saveInspection() {
    await apiPost(`/api/inspections/${leaseId}`, {
      kplcMeterReading: kplcReading ? Number(kplcReading) : undefined,
      kplcMeterNumber: kplcNumber || undefined,
      waterMeterReading: waterReading ? Number(waterReading) : undefined,
      waterMeterNumber: waterNumber || undefined,
      rooms,
    });
    load();
  }

  async function signOff() {
    await apiPost(`/api/inspections/${leaseId}/signoff`);
    load();
  }

  const bothSigned = inspection?.tenantSignedOff && inspection?.caretakerSignedOff;

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link href={me.role === "TENANT" ? "/tenant" : "/landlord"}>
          <Icon name="arrow_back" />
        </Link>
        <h1 className="font-headline-sm text-headline-sm">Move-in Inspection &amp; Key Handover</h1>
      </div>

      {bothSigned ? (
        <Card className="flex flex-col items-center gap-2 py-space-lg text-center">
          <Icon name="key" className="text-[36px] text-secondary" />
          <p className="font-headline-sm text-headline-sm">Funguo Zimekabidhiwa</p>
          <p className="text-on-surface-variant">Keys handed over. Tenancy is fully active.</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          <p className="font-label-md text-label-md">
            Tenant sign-off:{" "}
            {inspection?.tenantSignedOff ? (
              <Icon name="check_circle" className="text-secondary inline text-[16px]" />
            ) : (
              "Pending"
            )}
          </p>
          <p className="font-label-md text-label-md">
            Caretaker sign-off:{" "}
            {inspection?.caretakerSignedOff ? (
              <Icon name="check_circle" className="text-secondary inline text-[16px]" />
            ) : (
              "Pending"
            )}
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-space-md">
        <p className="font-label-lg text-label-lg font-bold">Vipimo vya Awali (Utility Baseline)</p>
        <div className="grid grid-cols-2 gap-space-sm">
          <TextField
            label="KPLC Reading"
            type="number"
            disabled={!canEdit}
            value={kplcReading}
            onChange={(e) => setKplcReading(e.target.value)}
          />
          <TextField
            label="KPLC Meter #"
            disabled={!canEdit}
            value={kplcNumber}
            onChange={(e) => setKplcNumber(e.target.value)}
          />
          <TextField
            label="Water Reading"
            type="number"
            disabled={!canEdit}
            value={waterReading}
            onChange={(e) => setWaterReading(e.target.value)}
          />
          <TextField
            label="Water Meter #"
            disabled={!canEdit}
            value={waterNumber}
            onChange={(e) => setWaterNumber(e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-space-md">
        <p className="font-label-lg text-label-lg font-bold">Ukaguzi wa Vyumba (Room Snag Report)</p>
        {rooms.map((room, idx) => (
          <div key={room.name} className="border-b border-outline-variant pb-space-sm last:border-0">
            <p className="font-label-md text-label-md font-bold">{room.name}</p>
            {canEdit ? (
              <div className="flex flex-col gap-2 mt-1">
                <select
                  value={room.condition}
                  onChange={(e) => {
                    const updated = [...rooms];
                    updated[idx] = { ...room, condition: e.target.value };
                    setRooms(updated);
                  }}
                  className="min-h-[44px] rounded-lg border border-outline-variant px-3"
                >
                  <option>Not yet checked</option>
                  <option>Safi ✓ (Good condition)</option>
                  <option>Needs attention</option>
                </select>
                <input
                  placeholder="Notes"
                  value={room.notes}
                  onChange={(e) => {
                    const updated = [...rooms];
                    updated[idx] = { ...room, notes: e.target.value };
                    setRooms(updated);
                  }}
                  className="min-h-[44px] rounded-lg border border-outline-variant px-3"
                />
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {room.condition} {room.notes ? `— ${room.notes}` : ""}
              </p>
            )}
          </div>
        ))}
        {canEdit && (
          <SecondaryButton onClick={saveInspection}>
            <Icon name="save" className="text-[18px]" />
            Save Inspection
          </SecondaryButton>
        )}
      </Card>

      {!bothSigned && (
        <PrimaryButton
          onClick={signOff}
          disabled={
            (me.role === "TENANT" && !!inspection?.tenantSignedOff) ||
            (me.role !== "TENANT" && !!inspection?.caretakerSignedOff)
          }
        >
          <Icon name="draw" className="text-[18px]" />
          {me.role === "TENANT" ? "Confirm & Sign as Tenant" : "Confirm & Sign as Caretaker"}
        </PrimaryButton>
      )}
    </div>
  );
}
