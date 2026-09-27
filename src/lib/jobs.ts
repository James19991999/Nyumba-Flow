import {
  generateMonthlyInvoicesForAllActiveLeases,
  listInvoicesNeedingReminder,
  markOverdueInvoices,
} from "./repo";
import { sendSms } from "./sms";

/**
 * Ensures every active lease has an invoice for the current month.
 * Safe to call as often as you like — it's a no-op once the invoice exists.
 */
export async function runGenerateMonthlyInvoices(): Promise<{ created: number }> {
  const created = await generateMonthlyInvoicesForAllActiveLeases();
  return { created };
}

/**
 * Sends an SMS nudge for every invoice due within 3 days or already overdue,
 * and flips any past-due DUE invoice to OVERDUE. This is what the original
 * design's "Automated M-Pesa Reminders — Scheduled SMS & STK prompts go out
 * on the 1st and 5th of every month" note refers to.
 */
export async function runSendRentReminders(): Promise<{ overdueMarked: number; remindersSent: number }> {
  const overdueMarked = await markOverdueInvoices();
  const due = await listInvoicesNeedingReminder();

  let remindersSent = 0;
  for (const item of due) {
    const balance = item.invoice.amountDue - item.invoice.amountPaid;
    if (balance <= 0) continue;

    const message =
      item.daysUntilDue > 0
        ? `Kodi ya ${item.propertyName} (${item.unitLabel}) ya KES ${balance.toLocaleString(
            "en-KE"
          )} inatarajiwa ${item.daysUntilDue === 1 ? "kesho" : `siku ${item.daysUntilDue}`}. Lipa kupitia NyumbaFlow app.`
        : `Kodi ya ${item.propertyName} (${item.unitLabel}) ya KES ${balance.toLocaleString(
            "en-KE"
          )} imechelewa. Tafadhali lipa haraka kupitia NyumbaFlow app kuepuka faini.`;

    await sendSms(item.tenantPhone, message);
    remindersSent += 1;
  }

  return { overdueMarked, remindersSent };
}
