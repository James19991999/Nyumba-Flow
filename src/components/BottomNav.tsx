"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";
import { useLanguage } from "@/lib/i18n";

export function LandlordBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const LANDLORD_TABS = [
    { href: "/landlord", icon: "dashboard", label: t("dashboard") },
    { href: "/landlord/properties", icon: "apartment", label: t("properties") },
    { href: "/landlord/payments", icon: "payments", label: t("payments") },
    { href: "/landlord/maintenance", icon: "build", label: t("maintenance") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant pb-safe">
      <div className="grid grid-cols-4 max-w-3xl mx-auto">
        {LANDLORD_TABS.map((tab) => {
          const active =
            tab.href === "/landlord"
              ? pathname === "/landlord"
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 py-2.5"
            >
              <Icon
                name={tab.icon}
                className={active ? "text-primary-container" : "text-outline"}
              />
              <span
                className={`font-label-sm text-label-sm ${
                  active ? "text-primary-container font-bold" : "text-outline"
                }`}
              >
                {tab.label}
              </span>
              {active && <span className="w-1 h-1 rounded-full bg-secondary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
