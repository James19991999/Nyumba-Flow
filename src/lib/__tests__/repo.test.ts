import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

// Tests run against a real PostgreSQL database (schema.sql is applied
// automatically via ensureSchema() on first query — see src/lib/db.ts).
// Set TEST_DATABASE_URL (falling back to DATABASE_URL) to a throwaway/test
// database before running `npm test`.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";
process.env.JWT_SECRET = "test-secret";

const repo = await import("../repo");

// Unique-ish suffix so re-runs against a persistent test database (rather
// than a throwaway one) don't collide on the UNIQUE phone/email constraints.
const run = randomUUID().slice(0, 8);

describe("lease + invoice + payment lifecycle", () => {
  let tenantId: string;
  let unitId: string;

  beforeAll(async () => {
    const landlord = await repo.createUser({
      role: "LANDLORD",
      fullName: "Test Landlord",
      phone: `254700${run}01`,
      passwordHash: "x",
    });
    const tenant = await repo.createUser({
      role: "TENANT",
      fullName: "Test Tenant",
      phone: `254700${run}02`,
      passwordHash: "x",
    });
    const property = await repo.createProperty({
      landlordId: landlord.id,
      name: "Test Estate",
      location: "Nairobi",
    });
    const unit = await repo.createUnit({
      propertyId: property.id,
      label: "A1",
      targetRent: 20000,
    });
    tenantId = tenant.id;
    unitId = unit.id;
  });

  it("creates a lease in PENDING_SIGNATURE", async () => {
    const lease = await repo.createLease({
      unitId,
      tenantId,
      monthlyRent: 20000,
      securityDeposit: 20000,
      serviceCharge: 1500,
      moveInDate: "2026-01-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    expect(lease.status).toBe("PENDING_SIGNATURE");
  });

  it("signing a lease generates the correct move-in invoice total", async () => {
    const lease = await repo.createLease({
      unitId,
      tenantId,
      monthlyRent: 20000,
      securityDeposit: 20000,
      serviceCharge: 1500,
      moveInDate: "2026-01-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    const signed = await repo.signLease(lease.id, "Test Tenant", "12345678");
    expect(signed.status).toBe("PENDING_PAYMENT");

    const invoice = await repo.createInvoice({
      leaseId: lease.id,
      period: "MOVE_IN",
      amountDue: signed.monthlyRent + signed.securityDeposit + signed.serviceCharge,
      dueDate: signed.moveInDate,
      isMoveInInvoice: true,
    });
    // 20000 rent + 20000 deposit + 1500 service charge
    expect(invoice.amountDue).toBe(41500);
  });

  it("activates the lease and occupies the unit once the move-in invoice is settled", async () => {
    const lease = await repo.createLease({
      unitId,
      tenantId,
      monthlyRent: 20000,
      securityDeposit: 20000,
      serviceCharge: 0,
      moveInDate: "2026-01-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    await repo.signLease(lease.id, "Test Tenant", "12345678");
    const invoice = await repo.createInvoice({
      leaseId: lease.id,
      period: "MOVE_IN",
      amountDue: 40000,
      dueDate: "2026-01-01",
      isMoveInInvoice: true,
    });

    const payment = await repo.createPaymentTransaction({
      invoiceId: invoice.id,
      leaseId: lease.id,
      tenantId,
      amount: 40000,
      channel: "MPESA",
    });
    await repo.settleCompletedPayment(payment.id);

    const updatedLease = (await repo.getLeaseById(lease.id))!;
    expect(updatedLease.status).toBe("ACTIVE");

    const unit = (await repo.getUnitById(unitId))!;
    expect(unit.status).toBe("OCCUPIED");

    const updatedInvoice = (await repo.getInvoiceById(invoice.id))!;
    expect(updatedInvoice.status).toBe("PAID");
    expect(updatedInvoice.amountPaid).toBe(40000);
  });

  it("does not double-credit a payment that is settled twice", async () => {
    const lease = await repo.createLease({
      unitId,
      tenantId,
      monthlyRent: 15000,
      securityDeposit: 15000,
      serviceCharge: 0,
      moveInDate: "2026-02-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    const activeLease = await repo.activateLease(lease.id);
    const invoice = await repo.getOrCreateCurrentInvoice(activeLease);

    const payment = await repo.createPaymentTransaction({
      invoiceId: invoice.id,
      leaseId: lease.id,
      tenantId,
      amount: invoice.amountDue,
      channel: "MPESA",
    });

    await repo.settleCompletedPayment(payment.id);
    await repo.settleCompletedPayment(payment.id); // simulate a duplicate webhook delivery

    const updatedInvoice = (await repo.getInvoiceById(invoice.id))!;
    expect(updatedInvoice.amountPaid).toBe(invoice.amountDue); // not doubled
  });

  it("marks an invoice PARTIAL when a partial payment is applied", async () => {
    const lease = await repo.createLease({
      unitId,
      tenantId,
      monthlyRent: 30000,
      securityDeposit: 30000,
      serviceCharge: 0,
      moveInDate: "2026-03-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    const activeLease = await repo.activateLease(lease.id);
    const invoice = await repo.getOrCreateCurrentInvoice(activeLease);

    const payment = await repo.createPaymentTransaction({
      invoiceId: invoice.id,
      leaseId: lease.id,
      tenantId,
      amount: 10000, // partial
      channel: "MPESA",
    });
    await repo.settleCompletedPayment(payment.id);

    const updatedInvoice = (await repo.getInvoiceById(invoice.id))!;
    expect(updatedInvoice.status).toBe("PARTIAL");
    expect(updatedInvoice.amountPaid).toBe(10000);
  });
});

describe("landlord dashboard aggregation", () => {
  it("computes arrears only for unpaid active leases", async () => {
    const landlord = await repo.createUser({
      role: "LANDLORD",
      fullName: "Dash Landlord",
      phone: `254700${run}10`,
      passwordHash: "x",
    });
    const tenant = await repo.createUser({
      role: "TENANT",
      fullName: "Dash Tenant",
      phone: `254700${run}11`,
      passwordHash: "x",
    });
    const property = await repo.createProperty({
      landlordId: landlord.id,
      name: "Dash Estate",
      location: "Nairobi",
    });
    const unit = await repo.createUnit({ propertyId: property.id, label: "D1", targetRent: 25000 });
    const lease = await repo.createLease({
      unitId: unit.id,
      tenantId: tenant.id,
      monthlyRent: 25000,
      securityDeposit: 25000,
      serviceCharge: 0,
      moveInDate: "2026-01-01",
      leaseTermMonths: 12,
      rentDueDay: 5,
      lateFeePerDay: 300,
    });
    await repo.activateLease(lease.id);

    const summary = await repo.getLandlordDashboardSummary(landlord.id);
    expect(summary.totalUnits).toBe(1);
    expect(summary.occupiedUnits).toBe(1);
    expect(summary.arrears.length).toBe(1);
    expect(summary.arrears[0].amount).toBe(25000);
  });
});
