export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Seed demo data once per cold start if the database is empty. Cheap and
  // idempotent (seedIfEmpty checks the users table first), safe to run on
  // every cold start on serverless platforms.
  const { seedIfEmpty } = await import("./lib/seed");
  try {
    await seedIfEmpty();
  } catch (err) {
    // Don't crash the whole app if the database isn't reachable yet at boot
    // (e.g. DATABASE_URL misconfigured) — let individual requests surface
    // that error instead, since instrumentation failures crash every route.
    console.error("[instrumentation] seedIfEmpty failed", err);
  }

  // Billing jobs (monthly invoice generation + rent reminders) are triggered
  // by an EXTERNAL scheduler hitting /api/cron/generate-invoices and
  // /api/cron/send-reminders — see the README's "Scheduled jobs" section.
  //
  // There is deliberately no in-process (node-cron) scheduler here: on
  // serverless platforms (Vercel and similar) each request may run in a
  // separate, short-lived function instance, so a timer started in one
  // instance has no guarantee of ever firing, and would silently do nothing.
  // Point Vercel Cron, GitHub Actions, or any external scheduler at the two
  // endpoints above with `Authorization: Bearer <CRON_SECRET>` instead.
}
