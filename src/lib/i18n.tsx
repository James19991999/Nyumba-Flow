"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "sw";

const DICTIONARY = {
  sign_out: { en: "Sign out", sw: "Toka" },
  loading: { en: "Loading…", sw: "Inapakia…" },
  dashboard: { en: "Dashboard", sw: "Dashibodi" },
  properties: { en: "Properties", sw: "Nyumba" },
  payments: { en: "Payments", sw: "Malipo" },
  maintenance: { en: "Maintenance", sw: "Matengenezo" },
  tenant_portal: { en: "Tenant Portal", sw: "Ukurasa wa Mpangaji" },
  welcome_back: { en: "Welcome back", sw: "Karibu Tena" },
  monthly_inflow: { en: "Monthly Inflow", sw: "Mapato ya Mwezi" },
  arrears: { en: "Arrears & Delinquencies", sw: "Madeni ya Kodi" },
  no_arrears: { en: "All rent collected this month 🎉", sw: "Kodi yote imelipwa mwezi huu 🎉" },
  add_property: { en: "Add Property", sw: "Ongeza Mali" },
  add_unit: { en: "Add Unit", sw: "Ongeza Chumba" },
  add_tenant: { en: "Add Tenant", sw: "Ongeza Mpangaji" },
  occupied: { en: "Occupied", sw: "Imejaa" },
  vacant: { en: "Vacant", sw: "Wazi" },
  report_issue: { en: "Report Issue", sw: "Ripoti Tatizo" },
  pay_with_mpesa: { en: "Pay with M-Pesa", sw: "Lipa na M-Pesa" },
  rent_balance: { en: "Rent Balance", sw: "Salio la Kodi" },
  fully_paid: { en: "Fully Paid", sw: "Imelipwa Kamili" },
  payment_history: { en: "Payment History", sw: "Historia ya Malipo" },
  notice_board: { en: "Notice Board", sw: "Ubao wa Matangazo" },
  no_data_yet: { en: "Nothing here yet", sw: "Hakuna kitu bado" },
  manage_ticket: { en: "Manage Ticket", sw: "Simamia Tiketi" },
  open_tickets: { en: "Open Tickets", sw: "Tiketi Wazi" },
  resolved: { en: "Resolved", sw: "Zimetatuliwa" },
  active_leases: { en: "Active Leases", sw: "Mikataba Inayoendelea" },
  download_statement: { en: "Download Statement", sw: "Pakua Taarifa" },
  create_account: { en: "Create Account", sw: "Fungua Akaunti" },
  sign_in: { en: "Sign In", sw: "Ingia" },
  forgot_password: { en: "Forgot password", sw: "Umesahau Nenosiri" },
} as const;

type Key = keyof typeof DICTIONARY;

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nf_lang");
      if (stored === "en" || stored === "sw") setLangState(stored);
    } catch {
      // localStorage unavailable (private mode etc.) — default to English.
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("nf_lang", l);
    } catch {
      // best-effort only
    }
  }

  function t(key: Key) {
    return DICTIONARY[key]?.[lang] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
