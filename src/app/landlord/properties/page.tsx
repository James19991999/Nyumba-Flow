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
  PrimaryButton,
  GhostButton,
  TextField,
  ModalShell,
} from "@/components/ui";
import { NewLeaseModal } from "@/components/NewLeaseModal";

interface Property {
  id: string;
  name: string;
  location: string;
}

interface Unit {
  id: string;
  propertyId: string;
  label: string;
  bedrooms: string | null;
  targetRent: number;
  status: "VACANT" | "OCCUPIED" | "NOTICE";
  leaseId?: string | null;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [error, setError] = useState("");
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [addingUnitFor, setAddingUnitFor] = useState<string | null>(null);
  const [leaseUnit, setLeaseUnit] = useState<Unit | null>(null);

  async function load() {
    try {
      const res = await apiGet<{ properties: Property[] }>("/api/properties");
      setProperties(res.properties);
      const unitsMap: Record<string, Unit[]> = {};
      await Promise.all(
        res.properties.map(async (p) => {
          const u = await apiGet<{ units: Unit[] }>(`/api/properties/${p.id}/units`);
          unitsMap[p.id] = u.units;
        })
      );
      setUnits(unitsMap);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!properties) return <Spinner />;

  const totalUnits = Object.values(units).flat().length;
  const projected = Object.values(units)
    .flat()
    .reduce((sum, u) => sum + u.targetRent, 0);

  return (
    <div className="flex flex-col gap-space-lg px-margin pt-space-md pb-space-lg">
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-headline-md text-headline-md">{totalUnits} Units Managed</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            Total Projected: <Money amount={projected} /> /mo
          </p>
        </div>
        <GhostButton onClick={() => setShowAddProperty(true)}>
          <Icon name="add_circle" className="text-[18px]" />
          Mali Mpya
        </GhostButton>
      </Card>

      {properties.length === 0 && (
        <Card className="text-center py-space-lg text-on-surface-variant">
          No properties yet — add your first one to get started.
        </Card>
      )}

      {properties.map((p) => {
        const propUnits = units[p.id] || [];
        const occupied = propUnits.filter((u) => u.status === "OCCUPIED").length;
        return (
          <Card key={p.id} className="flex flex-col gap-space-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-headline-sm text-headline-sm">{p.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                  <Icon name="location_on" className="text-[14px]" />
                  {p.location}
                </p>
              </div>
              <Pill tone={occupied === propUnits.length && propUnits.length > 0 ? "success" : "warning"}>
                {propUnits.length > 0 ? Math.round((occupied / propUnits.length) * 100) : 0}% Let
              </Pill>
            </div>

            <div className="flex flex-col gap-space-xs">
              {propUnits.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between bg-surface-container-low rounded-xl p-space-sm"
                >
                  <div>
                    <p className="font-label-md text-label-md font-bold">
                      {u.label} {u.bedrooms ? `· ${u.bedrooms}` : ""}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      <Money amount={u.targetRent} /> /mo
                    </p>
                  </div>
                  {u.status === "VACANT" ? (
                    <button
                      onClick={() => setLeaseUnit(u)}
                      className="px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-bold"
                    >
                      + Add Tenant
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {u.leaseId && (
                        <a
                          href={`/inspections/${u.leaseId}`}
                          className="font-label-sm text-label-sm text-primary-container underline"
                        >
                          Inspection
                        </a>
                      )}
                      <Pill tone="success">Occupied</Pill>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <GhostButton onClick={() => setAddingUnitFor(p.id)}>
              <Icon name="add" className="text-[18px]" />
              Ongeza Unit
            </GhostButton>
          </Card>
        );
      })}

      {showAddProperty && (
        <AddPropertyModal
          onClose={() => setShowAddProperty(false)}
          onCreated={() => {
            setShowAddProperty(false);
            load();
          }}
        />
      )}

      {addingUnitFor && (
        <AddUnitModal
          propertyId={addingUnitFor}
          onClose={() => setAddingUnitFor(null)}
          onCreated={() => {
            setAddingUnitFor(null);
            load();
          }}
        />
      )}

      {leaseUnit && (
        <NewLeaseModal
          unit={leaseUnit}
          onClose={() => setLeaseUnit(null)}
          onCreated={() => {
            setLeaseUnit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddPropertyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/properties", { name, location });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Add Property / Mali Mpya" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <ErrorBanner message={error} />
        <TextField label="Property Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Location"
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading}>
          Save Property
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}

function AddUnitModal({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [targetRent, setTargetRent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiPost(`/api/properties/${propertyId}/units`, {
        label,
        bedrooms,
        targetRent: Number(targetRent),
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Add Unit / Ongeza Unit" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <ErrorBanner message={error} />
        <TextField label="Unit Label" placeholder="e.g. Apt 4B" required value={label} onChange={(e) => setLabel(e.target.value)} />
        <TextField label="Bedrooms" placeholder="e.g. 2 Bedroom" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        <TextField
          label="Target Rent (KES)"
          type="number"
          required
          value={targetRent}
          onChange={(e) => setTargetRent(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading}>
          Save Unit
        </PrimaryButton>
      </form>
    </ModalShell>
  );
}

