import { queryOne, queryAll, execute } from "./db";
import { newId } from "./ids";

// ---------- Users ----------

export interface UserRow {
  id: string;
  role: "LANDLORD" | "TENANT" | "CARETAKER";
  fullName: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  nationalId: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export async function findUserByPhone(phone: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(
    `SELECT id, role, full_name as "fullName", email, phone, password_hash as "passwordHash",
            national_id as "nationalId", avatar_url as "avatarUrl", created_at as "createdAt"
     FROM users WHERE phone = ?`,
    [phone]
  );
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(
    `SELECT id, role, full_name as "fullName", email, phone, password_hash as "passwordHash",
            national_id as "nationalId", avatar_url as "avatarUrl", created_at as "createdAt"
     FROM users WHERE email = ?`,
    [email]
  );
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>(
    `SELECT id, role, full_name as "fullName", email, phone, password_hash as "passwordHash",
            national_id as "nationalId", avatar_url as "avatarUrl", created_at as "createdAt"
     FROM users WHERE id = ?`,
    [id]
  );
}

export async function createUser(input: {
  role: "LANDLORD" | "TENANT" | "CARETAKER";
  fullName: string;
  email?: string | null;
  phone: string;
  passwordHash: string;
  nationalId?: string | null;
}): Promise<UserRow> {
  const id = newId("usr");
  await execute(
    `INSERT INTO users (id, role, full_name, email, phone, password_hash, national_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.role,
      input.fullName,
      input.email ?? null,
      input.phone,
      input.passwordHash,
      input.nationalId ?? null,
    ]
  );
  return (await findUserById(id))!;
}

// ---------- OTP ----------

export async function createOtpCode(
  phone: string,
  code: string,
  ttlMinutes = 5,
  purpose: "LOGIN" | "PASSWORD_RESET" = "LOGIN"
) {
  const id = newId("otp");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  await execute(
    `INSERT INTO otp_codes (id, phone, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, phone, code, purpose, expiresAt]
  );
  return id;
}

export async function consumeOtpCode(
  phone: string,
  code: string,
  purpose: "LOGIN" | "PASSWORD_RESET" = "LOGIN"
): Promise<boolean> {
  const row = await queryOne<{ id: string; expiresAt: string | Date; consumed: number }>(
    `SELECT id, expires_at as "expiresAt", consumed FROM otp_codes
     WHERE phone = ? AND code = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`,
    [phone, code, purpose]
  );

  if (!row || row.consumed) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) return false;

  await execute(`UPDATE otp_codes SET consumed = 1 WHERE id = ?`, [row.id]);
  return true;
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
}

export async function deleteUserAccount(userId: string) {
  // Anonymize rather than hard-delete so financial/lease records (which
  // landlords and tax/audit requirements need to keep) stay intact, while
  // removing personally identifying information — a common, defensible
  // interpretation of a Kenya Data Protection Act deletion request for a
  // party to an ongoing financial relationship.
  const anonPhone = `deleted_${userId}`;
  await execute(
    `UPDATE users SET full_name = 'Deleted User', email = NULL, phone = ?,
      national_id = NULL, avatar_url = NULL, password_hash = 'deleted'
     WHERE id = ?`,
    [anonPhone, userId]
  );
}

// ---------- Properties & Units ----------

export interface PropertyRow {
  id: string;
  landlordId: string;
  name: string;
  location: string;
  createdAt: string;
}

export async function listPropertiesForLandlord(landlordId: string): Promise<PropertyRow[]> {
  return queryAll<PropertyRow>(
    `SELECT id, landlord_id as "landlordId", name, location, created_at as "createdAt"
     FROM properties WHERE landlord_id = ? ORDER BY created_at DESC`,
    [landlordId]
  );
}

export async function getPropertyById(id: string): Promise<PropertyRow | undefined> {
  return queryOne<PropertyRow>(
    `SELECT id, landlord_id as "landlordId", name, location, created_at as "createdAt"
     FROM properties WHERE id = ?`,
    [id]
  );
}

export async function createProperty(input: {
  landlordId: string;
  name: string;
  location: string;
}): Promise<PropertyRow> {
  const id = newId("prop");
  await execute(`INSERT INTO properties (id, landlord_id, name, location) VALUES (?, ?, ?, ?)`, [
    id,
    input.landlordId,
    input.name,
    input.location,
  ]);
  return (await getPropertyById(id))!;
}

export interface UnitRow {
  id: string;
  propertyId: string;
  label: string;
  bedrooms: string | null;
  targetRent: number;
  status: "VACANT" | "OCCUPIED" | "NOTICE";
  createdAt: string;
}

export async function listUnitsForProperty(propertyId: string): Promise<UnitRow[]> {
  return queryAll<UnitRow>(
    `SELECT id, property_id as "propertyId", label, bedrooms, target_rent as "targetRent",
            status, created_at as "createdAt"
     FROM units WHERE property_id = ? ORDER BY label`,
    [propertyId]
  );
}

export async function getUnitById(id: string): Promise<UnitRow | undefined> {
  return queryOne<UnitRow>(
    `SELECT id, property_id as "propertyId", label, bedrooms, target_rent as "targetRent",
            status, created_at as "createdAt"
     FROM units WHERE id = ?`,
    [id]
  );
}

export async function createUnit(input: {
  propertyId: string;
  label: string;
  bedrooms?: string | null;
  targetRent: number;
  status?: "VACANT" | "OCCUPIED" | "NOTICE";
}): Promise<UnitRow> {
  const id = newId("unit");
  await execute(
    `INSERT INTO units (id, property_id, label, bedrooms, target_rent, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.label,
      input.bedrooms ?? null,
      input.targetRent,
      input.status ?? "VACANT",
    ]
  );
  return (await getUnitById(id))!;
}

export async function setUnitStatus(id: string, status: UnitRow["status"]) {
  await execute(`UPDATE units SET status = ? WHERE id = ?`, [status, id]);
}

export async function listLandlordPortfolio(landlordId: string) {
  const properties = await listPropertiesForLandlord(landlordId);
  return Promise.all(
    properties.map(async (property) => {
      const units = await listUnitsForProperty(property.id);
      return {
        ...property,
        units: await Promise.all(
          units.map(async (unit) => {
            const lease = await getActiveLeaseForUnit(unit.id);
            return { ...unit, lease };
          })
        ),
      };
    })
  );
}

// ---------- Leases ----------

export interface LeaseRow {
  id: string;
  unitId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  serviceCharge: number;
  moveInDate: string;
  leaseTermMonths: number;
  rentDueDay: number;
  lateFeePerDay: number;
  status: "DRAFT" | "PENDING_SIGNATURE" | "PENDING_PAYMENT" | "ACTIVE" | "TERMINATED";
  signatureName: string | null;
  signatureNationalId: string | null;
  signedAt: string | null;
  createdAt: string;
}

const LEASE_COLUMNS = `id, unit_id as "unitId", tenant_id as "tenantId", monthly_rent as "monthlyRent",
  security_deposit as "securityDeposit", service_charge as "serviceCharge", move_in_date as "moveInDate",
  lease_term_months as "leaseTermMonths", rent_due_day as "rentDueDay", late_fee_per_day as "lateFeePerDay",
  status, signature_name as "signatureName", signature_national_id as "signatureNationalId",
  signed_at as "signedAt", created_at as "createdAt"`;

export async function getLeaseById(id: string): Promise<LeaseRow | undefined> {
  return queryOne<LeaseRow>(`SELECT ${LEASE_COLUMNS} FROM leases WHERE id = ?`, [id]);
}

export async function getActiveLeaseForUnit(unitId: string): Promise<LeaseRow | undefined> {
  return queryOne<LeaseRow>(
    `SELECT ${LEASE_COLUMNS} FROM leases WHERE unit_id = ? AND status != 'TERMINATED'
     ORDER BY created_at DESC LIMIT 1`,
    [unitId]
  );
}

export async function getActiveLeaseForTenant(tenantId: string): Promise<LeaseRow | undefined> {
  return queryOne<LeaseRow>(
    `SELECT ${LEASE_COLUMNS} FROM leases WHERE tenant_id = ? AND status != 'TERMINATED'
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
}

const LEASE_COLUMNS_QUALIFIED = `leases.id, leases.unit_id as "unitId", leases.tenant_id as "tenantId",
  leases.monthly_rent as "monthlyRent", leases.security_deposit as "securityDeposit",
  leases.service_charge as "serviceCharge", leases.move_in_date as "moveInDate",
  leases.lease_term_months as "leaseTermMonths", leases.rent_due_day as "rentDueDay",
  leases.late_fee_per_day as "lateFeePerDay", leases.status, leases.signature_name as "signatureName",
  leases.signature_national_id as "signatureNationalId", leases.signed_at as "signedAt",
  leases.created_at as "createdAt"`;

export async function listLeasesForLandlord(landlordId: string): Promise<LeaseRow[]> {
  return queryAll<LeaseRow>(
    `SELECT ${LEASE_COLUMNS_QUALIFIED} FROM leases
     JOIN units ON units.id = leases.unit_id
     JOIN properties ON properties.id = units.property_id
     WHERE properties.landlord_id = ?
     ORDER BY leases.created_at DESC`,
    [landlordId]
  );
}

export async function createLease(input: {
  unitId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  serviceCharge: number;
  moveInDate: string;
  leaseTermMonths: number;
  rentDueDay: number;
  lateFeePerDay: number;
}): Promise<LeaseRow> {
  const id = newId("lease");
  await execute(
    `INSERT INTO leases (id, unit_id, tenant_id, monthly_rent, security_deposit, service_charge,
      move_in_date, lease_term_months, rent_due_day, late_fee_per_day, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SIGNATURE')`,
    [
      id,
      input.unitId,
      input.tenantId,
      input.monthlyRent,
      input.securityDeposit,
      input.serviceCharge,
      input.moveInDate,
      input.leaseTermMonths,
      input.rentDueDay,
      input.lateFeePerDay,
    ]
  );
  return (await getLeaseById(id))!;
}

export async function signLease(id: string, signatureName: string, signatureNationalId: string) {
  await execute(
    `UPDATE leases SET signature_name = ?, signature_national_id = ?, signed_at = now(),
      status = 'PENDING_PAYMENT' WHERE id = ?`,
    [signatureName, signatureNationalId, id]
  );
  return (await getLeaseById(id))!;
}

export async function activateLease(id: string) {
  const lease = await getLeaseById(id);
  if (!lease) throw new Error("Lease not found");
  await execute(`UPDATE leases SET status = 'ACTIVE' WHERE id = ?`, [id]);
  await setUnitStatus(lease.unitId, "OCCUPIED");
  return (await getLeaseById(id))!;
}

// ---------- Rent invoices ----------

export interface InvoiceRow {
  id: string;
  leaseId: string;
  period: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: "DUE" | "PARTIAL" | "PAID" | "OVERDUE";
  isMoveInInvoice: number;
  createdAt: string;
}

const INVOICE_COLUMNS = `id, lease_id as "leaseId", period, amount_due as "amountDue",
  amount_paid as "amountPaid", due_date as "dueDate", status, is_move_in_invoice as "isMoveInInvoice",
  created_at as "createdAt"`;

export async function listInvoicesForLease(leaseId: string): Promise<InvoiceRow[]> {
  return queryAll<InvoiceRow>(
    `SELECT ${INVOICE_COLUMNS} FROM rent_invoices WHERE lease_id = ? ORDER BY due_date DESC`,
    [leaseId]
  );
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | undefined> {
  return queryOne<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} FROM rent_invoices WHERE id = ?`, [id]);
}

export async function createInvoice(input: {
  leaseId: string;
  period: string;
  amountDue: number;
  dueDate: string;
  isMoveInInvoice?: boolean;
}): Promise<InvoiceRow> {
  const id = newId("inv");
  await execute(
    `INSERT INTO rent_invoices (id, lease_id, period, amount_due, due_date, is_move_in_invoice)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.leaseId, input.period, input.amountDue, input.dueDate, input.isMoveInInvoice ? 1 : 0]
  );
  return (await getInvoiceById(id))!;
}

export async function applyPaymentToInvoice(invoiceId: string, amount: number) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return;
  const newPaid = invoice.amountPaid + amount;
  const status = newPaid >= invoice.amountDue ? "PAID" : "PARTIAL";
  await execute(`UPDATE rent_invoices SET amount_paid = ?, status = ? WHERE id = ?`, [
    newPaid,
    status,
    invoiceId,
  ]);
}

export async function getOrCreateCurrentInvoice(lease: LeaseRow): Promise<InvoiceRow> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const existing = await queryOne<InvoiceRow>(
    `SELECT ${INVOICE_COLUMNS} FROM rent_invoices WHERE lease_id = ? AND period = ? AND is_move_in_invoice = 0`,
    [lease.id, period]
  );
  if (existing) return existing;

  const dueDate = new Date(now.getFullYear(), now.getMonth(), lease.rentDueDay)
    .toISOString()
    .slice(0, 10);
  return createInvoice({
    leaseId: lease.id,
    period,
    amountDue: lease.monthlyRent,
    dueDate,
  });
}

// ---------- Payment transactions ----------

export interface PaymentRow {
  id: string;
  invoiceId: string | null;
  leaseId: string | null;
  tenantId: string;
  amount: number;
  channel: "MPESA" | "AIRTEL" | "CARD" | "BANK";
  phoneNumber: string | null;
  provider: string;
  intasendInvoiceId: string | null;
  intasendTrackingId: string | null;
  intasendCheckoutId: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const PAYMENT_COLUMNS = `id, invoice_id as "invoiceId", lease_id as "leaseId", tenant_id as "tenantId",
  amount, channel, phone_number as "phoneNumber", provider, intasend_invoice_id as "intasendInvoiceId",
  intasend_tracking_id as "intasendTrackingId", intasend_checkout_id as "intasendCheckoutId",
  status, failure_reason as "failureReason", created_at as "createdAt", updated_at as "updatedAt"`;

export async function createPaymentTransaction(input: {
  invoiceId?: string | null;
  leaseId?: string | null;
  tenantId: string;
  amount: number;
  channel: PaymentRow["channel"];
  phoneNumber?: string | null;
}): Promise<PaymentRow> {
  const id = newId("pay");
  await execute(
    `INSERT INTO payment_transactions (id, invoice_id, lease_id, tenant_id, amount, channel, phone_number)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.invoiceId ?? null,
      input.leaseId ?? null,
      input.tenantId,
      input.amount,
      input.channel,
      input.phoneNumber ?? null,
    ]
  );
  return (await getPaymentById(id))!;
}

export async function getPaymentById(id: string): Promise<PaymentRow | undefined> {
  return queryOne<PaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM payment_transactions WHERE id = ?`, [
    id,
  ]);
}

export async function setPaymentIntasendRefs(
  id: string,
  refs: { intasendInvoiceId?: string; intasendCheckoutId?: string }
) {
  await execute(
    `UPDATE payment_transactions SET intasend_invoice_id = COALESCE(?, intasend_invoice_id),
      intasend_checkout_id = COALESCE(?, intasend_checkout_id), updated_at = now()
     WHERE id = ?`,
    [refs.intasendInvoiceId ?? null, refs.intasendCheckoutId ?? null, id]
  );
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentRow["status"],
  failureReason?: string | null,
  rawWebhookJson?: string
) {
  await execute(
    `UPDATE payment_transactions SET status = ?, failure_reason = ?, raw_webhook_json = COALESCE(?, raw_webhook_json),
      updated_at = now() WHERE id = ?`,
    [status, failureReason ?? null, rawWebhookJson ?? null, id]
  );
}

export async function findPaymentByIntasendInvoiceId(
  intasendInvoiceId: string
): Promise<PaymentRow | undefined> {
  return queryOne<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS} FROM payment_transactions WHERE intasend_invoice_id = ?`,
    [intasendInvoiceId]
  );
}

export async function listPaymentsForLease(leaseId: string): Promise<PaymentRow[]> {
  return queryAll<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS} FROM payment_transactions WHERE lease_id = ? ORDER BY created_at DESC`,
    [leaseId]
  );
}

const PAYMENT_COLUMNS_QUALIFIED = `payment_transactions.id, payment_transactions.invoice_id as "invoiceId",
  payment_transactions.lease_id as "leaseId", payment_transactions.tenant_id as "tenantId",
  payment_transactions.amount, payment_transactions.channel, payment_transactions.phone_number as "phoneNumber",
  payment_transactions.provider, payment_transactions.intasend_invoice_id as "intasendInvoiceId",
  payment_transactions.intasend_tracking_id as "intasendTrackingId",
  payment_transactions.intasend_checkout_id as "intasendCheckoutId", payment_transactions.status,
  payment_transactions.failure_reason as "failureReason", payment_transactions.created_at as "createdAt",
  payment_transactions.updated_at as "updatedAt"`;

export async function listPaymentsForLandlord(landlordId: string): Promise<PaymentRow[]> {
  return queryAll<PaymentRow>(
    `SELECT ${PAYMENT_COLUMNS_QUALIFIED} FROM payment_transactions
     JOIN leases ON leases.id = payment_transactions.lease_id
     JOIN units ON units.id = leases.unit_id
     JOIN properties ON properties.id = units.property_id
     WHERE properties.landlord_id = ?
     ORDER BY payment_transactions.created_at DESC LIMIT 50`,
    [landlordId]
  );
}

// ---------- Maintenance tickets ----------

export interface TicketRow {
  id: string;
  unitId: string | null;
  propertyId: string;
  reportedBy: string;
  category: "PLUMBING" | "ELECTRICAL" | "CARPENTRY" | "OTHER";
  title: string;
  notes: string | null;
  priority: "URGENT" | "NORMAL";
  status: "REPORTED" | "ASSIGNED" | "QUOTED" | "REPAIRED" | "PAID";
  contractorName: string | null;
  contractorPhone: string | null;
  quoteAmount: number | null;
  quoteApproved: number;
  photoUrlsJson: string;
  createdAt: string;
  updatedAt: string;
}

const TICKET_COLUMNS = `id, unit_id as "unitId", property_id as "propertyId", reported_by as "reportedBy",
  category, title, notes, priority, status, contractor_name as "contractorName",
  contractor_phone as "contractorPhone", quote_amount as "quoteAmount", quote_approved as "quoteApproved",
  photo_urls_json as "photoUrlsJson", created_at as "createdAt", updated_at as "updatedAt"`;

export async function createTicket(input: {
  unitId?: string | null;
  propertyId: string;
  reportedBy: string;
  category: TicketRow["category"];
  title: string;
  notes?: string | null;
  priority?: TicketRow["priority"];
  photoUrls?: string[];
}): Promise<TicketRow> {
  const id = newId("tkt");
  await execute(
    `INSERT INTO maintenance_tickets (id, unit_id, property_id, reported_by, category, title, notes, priority, photo_urls_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.unitId ?? null,
      input.propertyId,
      input.reportedBy,
      input.category,
      input.title,
      input.notes ?? null,
      input.priority ?? "NORMAL",
      JSON.stringify(input.photoUrls ?? []),
    ]
  );
  return (await getTicketById(id))!;
}

export async function getTicketById(id: string): Promise<TicketRow | undefined> {
  return queryOne<TicketRow>(`SELECT ${TICKET_COLUMNS} FROM maintenance_tickets WHERE id = ?`, [
    id,
  ]);
}

export async function listTicketsForProperty(propertyId: string): Promise<TicketRow[]> {
  return queryAll<TicketRow>(
    `SELECT ${TICKET_COLUMNS} FROM maintenance_tickets WHERE property_id = ? ORDER BY created_at DESC`,
    [propertyId]
  );
}

const TICKET_COLUMNS_QUALIFIED = `maintenance_tickets.id, maintenance_tickets.unit_id as "unitId",
  maintenance_tickets.property_id as "propertyId", maintenance_tickets.reported_by as "reportedBy",
  maintenance_tickets.category, maintenance_tickets.title, maintenance_tickets.notes,
  maintenance_tickets.priority, maintenance_tickets.status,
  maintenance_tickets.contractor_name as "contractorName", maintenance_tickets.contractor_phone as "contractorPhone",
  maintenance_tickets.quote_amount as "quoteAmount", maintenance_tickets.quote_approved as "quoteApproved",
  maintenance_tickets.photo_urls_json as "photoUrlsJson", maintenance_tickets.created_at as "createdAt",
  maintenance_tickets.updated_at as "updatedAt"`;

export async function listTicketsForLandlord(landlordId: string): Promise<TicketRow[]> {
  return queryAll<TicketRow>(
    `SELECT ${TICKET_COLUMNS_QUALIFIED} FROM maintenance_tickets
     JOIN properties ON properties.id = maintenance_tickets.property_id
     WHERE properties.landlord_id = ?
     ORDER BY maintenance_tickets.created_at DESC`,
    [landlordId]
  );
}

export async function updateTicket(
  id: string,
  patch: Partial<{
    status: TicketRow["status"];
    contractorName: string;
    contractorPhone: string;
    quoteAmount: number;
    quoteApproved: boolean;
  }>
) {
  const current = await getTicketById(id);
  if (!current) throw new Error("Ticket not found");
  await execute(
    `UPDATE maintenance_tickets SET
      status = ?, contractor_name = ?, contractor_phone = ?, quote_amount = ?, quote_approved = ?,
      updated_at = now()
     WHERE id = ?`,
    [
      patch.status ?? current.status,
      patch.contractorName ?? current.contractorName,
      patch.contractorPhone ?? current.contractorPhone,
      patch.quoteAmount ?? current.quoteAmount,
      patch.quoteApproved !== undefined ? (patch.quoteApproved ? 1 : 0) : current.quoteApproved,
      id,
    ]
  );
  return (await getTicketById(id))!;
}

// ---------- Inspections ----------

export interface InspectionRow {
  id: string;
  leaseId: string;
  kplcMeterReading: number | null;
  kplcMeterNumber: string | null;
  waterMeterReading: number | null;
  waterMeterNumber: string | null;
  roomsJson: string;
  tenantSignedOff: number;
  caretakerSignedOff: number;
  keysHandedOver: number;
  completedAt: string | null;
  createdAt: string;
}

const INSPECTION_COLUMNS = `id, lease_id as "leaseId", kplc_meter_reading as "kplcMeterReading",
  kplc_meter_number as "kplcMeterNumber", water_meter_reading as "waterMeterReading",
  water_meter_number as "waterMeterNumber", rooms_json as "roomsJson", tenant_signed_off as "tenantSignedOff",
  caretaker_signed_off as "caretakerSignedOff", keys_handed_over as "keysHandedOver",
  completed_at as "completedAt", created_at as "createdAt"`;

export async function getInspectionForLease(leaseId: string): Promise<InspectionRow | undefined> {
  return queryOne<InspectionRow>(`SELECT ${INSPECTION_COLUMNS} FROM inspections WHERE lease_id = ?`, [
    leaseId,
  ]);
}

export async function upsertInspection(input: {
  leaseId: string;
  kplcMeterReading?: number;
  kplcMeterNumber?: string;
  waterMeterReading?: number;
  waterMeterNumber?: string;
  rooms?: Array<{ name: string; condition: string; notes: string; photos: number }>;
}): Promise<InspectionRow> {
  const existing = await getInspectionForLease(input.leaseId);
  if (existing) {
    await execute(
      `UPDATE inspections SET kplc_meter_reading = COALESCE(?, kplc_meter_reading),
        kplc_meter_number = COALESCE(?, kplc_meter_number),
        water_meter_reading = COALESCE(?, water_meter_reading),
        water_meter_number = COALESCE(?, water_meter_number),
        rooms_json = COALESCE(?, rooms_json)
       WHERE id = ?`,
      [
        input.kplcMeterReading ?? null,
        input.kplcMeterNumber ?? null,
        input.waterMeterReading ?? null,
        input.waterMeterNumber ?? null,
        input.rooms ? JSON.stringify(input.rooms) : null,
        existing.id,
      ]
    );
    return (await getInspectionForLease(input.leaseId))!;
  }
  const id = newId("insp");
  await execute(
    `INSERT INTO inspections (id, lease_id, kplc_meter_reading, kplc_meter_number,
      water_meter_reading, water_meter_number, rooms_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.leaseId,
      input.kplcMeterReading ?? null,
      input.kplcMeterNumber ?? null,
      input.waterMeterReading ?? null,
      input.waterMeterNumber ?? null,
      JSON.stringify(input.rooms ?? []),
    ]
  );
  return (await getInspectionForLease(input.leaseId))!;
}

export async function completeInspectionSignOff(leaseId: string, who: "TENANT" | "CARETAKER") {
  const existing = await getInspectionForLease(leaseId);
  if (!existing) throw new Error("Inspection not started");
  const field = who === "TENANT" ? "tenant_signed_off" : "caretaker_signed_off";
  await execute(`UPDATE inspections SET ${field} = 1 WHERE id = ?`, [existing.id]);
  const updated = (await getInspectionForLease(leaseId))!;
  if (updated.tenantSignedOff && updated.caretakerSignedOff) {
    await execute(`UPDATE inspections SET keys_handed_over = 1, completed_at = now() WHERE id = ?`, [
      existing.id,
    ]);
  }
  return (await getInspectionForLease(leaseId))!;
}

// ---------- Notices ----------

export interface NoticeRow {
  id: string;
  propertyId: string;
  title: string;
  body: string;
  category: string;
  postedBy: string;
  createdAt: string;
}

export async function listNoticesForProperty(propertyId: string): Promise<NoticeRow[]> {
  return queryAll<NoticeRow>(
    `SELECT id, property_id as "propertyId", title, body, category, posted_by as "postedBy",
            created_at as "createdAt"
     FROM notices WHERE property_id = ? ORDER BY created_at DESC LIMIT 10`,
    [propertyId]
  );
}

export async function listNoticesForTenant(tenantId: string): Promise<NoticeRow[]> {
  const lease = await getActiveLeaseForTenant(tenantId);
  if (!lease) return [];
  const unit = await getUnitById(lease.unitId);
  if (!unit) return [];
  return listNoticesForProperty(unit.propertyId);
}

export async function createNotice(input: {
  propertyId: string;
  title: string;
  body: string;
  category?: string;
  postedBy: string;
}): Promise<NoticeRow> {
  const id = newId("note");
  await execute(
    `INSERT INTO notices (id, property_id, title, body, category, posted_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.propertyId, input.title, input.body, input.category ?? "GENERAL", input.postedBy]
  );
  return (await queryOne<NoticeRow>(
    `SELECT id, property_id as "propertyId", title, body, category, posted_by as "postedBy",
            created_at as "createdAt" FROM notices WHERE id = ?`,
    [id]
  ))!;
}

// ---------- Payment settlement ----------

/**
 * Apply a COMPLETE payment to its invoice and, if that invoice was the
 * move-in invoice for a lease still pending payment, activate the lease
 * (marks the unit OCCUPIED). Shared by the IntaSend webhook handler and the
 * manual bank-transfer confirmation endpoint so both paths behave identically.
 */
export async function settleCompletedPayment(paymentId: string) {
  const payment = await getPaymentById(paymentId);
  if (!payment) return;
  if (payment.status === "COMPLETE") return; // already settled, avoid double-crediting

  await updatePaymentStatus(paymentId, "COMPLETE");

  if (payment.invoiceId) {
    await applyPaymentToInvoice(payment.invoiceId, payment.amount);
    const invoice = await getInvoiceById(payment.invoiceId);
    if (invoice?.isMoveInInvoice && invoice.status === "PAID" && payment.leaseId) {
      const lease = await getLeaseById(payment.leaseId);
      if (lease && lease.status === "PENDING_PAYMENT") {
        await activateLease(payment.leaseId);
      }
    }
  }
}

// ---------- Scheduled jobs support ----------

export async function listAllActiveLeases(): Promise<LeaseRow[]> {
  return queryAll<LeaseRow>(`SELECT ${LEASE_COLUMNS} FROM leases WHERE status = 'ACTIVE'`);
}

export interface DueInvoiceForReminder {
  invoice: InvoiceRow;
  lease: LeaseRow;
  tenantPhone: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  daysUntilDue: number;
}

/**
 * Finds unpaid/partial invoices due today, in the next 3 days, or already
 * overdue — the set a daily reminder job would want to nudge.
 */
export async function listInvoicesNeedingReminder(): Promise<DueInvoiceForReminder[]> {
  const rows = await queryAll<InvoiceRow>(
    `SELECT ${INVOICE_COLUMNS} FROM rent_invoices
     WHERE status IN ('DUE', 'PARTIAL', 'OVERDUE') AND is_move_in_invoice = 0`
  );

  const results: DueInvoiceForReminder[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const invoice of rows) {
    const lease = await getLeaseById(invoice.leaseId);
    if (!lease || lease.status !== "ACTIVE") continue;
    const unit = await getUnitById(lease.unitId);
    const property = unit ? await getPropertyById(unit.propertyId) : undefined;
    const tenant = await findUserById(lease.tenantId);
    if (!unit || !property || !tenant) continue;

    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.round((dueDate.getTime() - now.getTime()) / 86_400_000);

    // Remind 3 days before, on the due date, and every day once overdue.
    if (daysUntilDue <= 3) {
      results.push({
        invoice,
        lease,
        tenantPhone: tenant.phone,
        tenantName: tenant.fullName,
        unitLabel: unit.label,
        propertyName: property.name,
        daysUntilDue,
      });
    }
  }
  return results;
}

/** Marks any DUE invoice whose due date has passed as OVERDUE. */
export async function markOverdueInvoices(): Promise<number> {
  const result = await execute(
    `UPDATE rent_invoices SET status = 'OVERDUE'
     WHERE status = 'DUE' AND due_date::date < CURRENT_DATE`
  );
  return result.changes;
}

/** Idempotently ensures every active lease has this month's invoice created. */
export async function generateMonthlyInvoicesForAllActiveLeases(): Promise<number> {
  const leases = await listAllActiveLeases();
  let created = 0;
  for (const lease of leases) {
    const before = (await listInvoicesForLease(lease.id)).length;
    await getOrCreateCurrentInvoice(lease);
    const after = (await listInvoicesForLease(lease.id)).length;
    if (after > before) created += 1;
  }
  return created;
}

// ---------- Dashboard aggregation ----------

export async function getLandlordDashboardSummary(landlordId: string) {
  const portfolio = await listLandlordPortfolio(landlordId);
  const allUnits = portfolio.flatMap((p) => p.units);
  const occupied = allUnits.filter((u) => u.status === "OCCUPIED").length;

  let monthlyTarget = 0;
  let monthlyCollected = 0;
  const arrears: Array<{
    tenantId: string;
    leaseId: string;
    unitLabel: string;
    propertyName: string;
    amount: number;
    invoiceId: string;
    phone: string;
  }> = [];

  for (const property of portfolio) {
    for (const unit of property.units) {
      const lease = unit.lease;
      if (!lease || lease.status !== "ACTIVE") continue;
      monthlyTarget += lease.monthlyRent;
      const invoice = await getOrCreateCurrentInvoice(lease);
      monthlyCollected += invoice.amountPaid;
      if (invoice.status !== "PAID") {
        const tenant = await findUserById(lease.tenantId);
        arrears.push({
          tenantId: lease.tenantId,
          leaseId: lease.id,
          unitLabel: unit.label,
          propertyName: property.name,
          amount: invoice.amountDue - invoice.amountPaid,
          invoiceId: invoice.id,
          phone: tenant?.phone ?? "",
        });
      }
    }
  }

  const tickets = await listTicketsForLandlord(landlordId);
  const openTickets = tickets.filter((t) => t.status !== "PAID");
  const recentPayments = await listPaymentsForLandlord(landlordId);

  return {
    properties: portfolio,
    totalUnits: allUnits.length,
    occupiedUnits: occupied,
    monthlyTarget,
    monthlyCollected,
    arrears,
    openMaintenanceCount: openTickets.length,
    recentPayments: recentPayments.slice(0, 10),
  };
}
