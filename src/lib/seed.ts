import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  activateLease,
  getOrCreateCurrentInvoice,
  createPaymentTransaction,
  settleCompletedPayment,
  createTicket,
  createNotice,
  findUserByPhone,
} from "./repo";

/**
 * Seeds a demo landlord + tenant + portfolio matching the original Stitch
 * mockups (Kariuki Property Holdings / Kilimani Palms, Westlands Heights,
 * Ruaka Haven) so the app is immediately explorable after `npm run dev`,
 * with real database rows instead of hardcoded UI mock data.
 *
 * Runs once: it no-ops if any user already exists.
 */
export async function seedIfEmpty() {
  const count = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM users`);
  if (count && Number(count.c) > 0) return;

  const passwordHash = bcrypt.hashSync("password123", 10);

  const landlord = await createUser({
    role: "LANDLORD",
    fullName: "Kariuki Mwangi",
    phone: "254712000001",
    email: "kariuki@nyumbaflow.demo",
    passwordHash,
  });

  const tenant1 =
    (await findUserByPhone("254712345678")) ||
    (await createUser({
      role: "TENANT",
      fullName: "Jane Wanjiku Muthoni",
      phone: "254712345678",
      email: "jane@nyumbaflow.demo",
      passwordHash,
    }));

  const tenant2 = await createUser({
    role: "TENANT",
    fullName: "Brian Kiprop",
    phone: "254712000002",
    passwordHash,
  });

  const kilimani = await createProperty({
    landlordId: landlord.id,
    name: "Kilimani Palms Estate",
    location: "Argwings Kodhek, Nairobi",
  });
  const westlands = await createProperty({
    landlordId: landlord.id,
    name: "Westlands Heights",
    location: "Rhapta Rd, Westlands",
  });
  const ruaka = await createProperty({
    landlordId: landlord.id,
    name: "Ruaka Haven Studios",
    location: "Limuru Rd, Ruaka",
  });

  const unit101 = await createUnit({
    propertyId: kilimani.id,
    label: "Unit 101",
    bedrooms: "2 Bedroom",
    targetRent: 40000,
  });
  await createUnit({
    propertyId: kilimani.id,
    label: "Unit 102",
    bedrooms: "2 Bedroom",
    targetRent: 40000,
  });

  const unitB2 = await createUnit({
    propertyId: westlands.id,
    label: "Unit B2",
    bedrooms: "1 Bedroom",
    targetRent: 35000,
  });
  await createUnit({
    propertyId: westlands.id,
    label: "Studio A4",
    bedrooms: "Studio",
    targetRent: 25000,
  });

  await createUnit({ propertyId: ruaka.id, label: "Studio S1", bedrooms: "Studio", targetRent: 15000 });

  // Active, fully paid lease for Jane in Kilimani Palms Unit 101
  const lease1 = await createLease({
    unitId: unit101.id,
    tenantId: tenant1.id,
    monthlyRent: 40000,
    securityDeposit: 40000,
    serviceCharge: 3500,
    moveInDate: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1)
      .toISOString()
      .slice(0, 10),
    leaseTermMonths: 12,
    rentDueDay: 5,
    lateFeePerDay: 500,
  });
  const activeLease1 = await activateLease(lease1.id);
  const invoice1 = await getOrCreateCurrentInvoice(activeLease1);
  const payment1 = await createPaymentTransaction({
    invoiceId: invoice1.id,
    leaseId: lease1.id,
    tenantId: tenant1.id,
    amount: 40000,
    channel: "MPESA",
    phoneNumber: tenant1.phone,
  });
  await settleCompletedPayment(payment1.id);

  // Active, overdue lease for Brian in Westlands Heights Unit B2
  const lease2 = await createLease({
    unitId: unitB2.id,
    tenantId: tenant2.id,
    monthlyRent: 35000,
    securityDeposit: 35000,
    serviceCharge: 2000,
    moveInDate: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1)
      .toISOString()
      .slice(0, 10),
    leaseTermMonths: 12,
    rentDueDay: 5,
    lateFeePerDay: 500,
  });
  await activateLease(lease2.id);
  // leave this month's invoice unpaid so it shows up in Arrears

  await createTicket({
    propertyId: westlands.id,
    unitId: unitB2.id,
    reportedBy: tenant2.id,
    category: "PLUMBING",
    title: "Leaking Master Bathroom Pipe",
    notes: "Water leaking heavily under the vanity basin onto the floor.",
    priority: "URGENT",
  });

  await createNotice({
    propertyId: kilimani.id,
    title: "Water Tank Cleaning Scheduled",
    body: "Estate water tanks will be sanitized between 9:00 AM and 1:00 PM this Saturday.",
    category: "WATER",
    postedBy: landlord.id,
  });

  console.log(
    `\nNyumbaFlow demo data seeded.\n  Landlord login: 254712000001 / password123\n  Tenant login:   254712345678 / password123\n`
  );
}
