"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./ui";
import { apiPost } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";

export function TopBar({
  title,
  subtitle,
  fullName,
}: {
  title: string;
  subtitle: string;
  fullName: string;
}) {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 px-margin flex items-center justify-between max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-surface-container-lowest">
            <Icon name="apartment" className="text-[18px]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">
                {title}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant leading-none mt-0.5">
              {subtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            aria-label="Account & privacy"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors"
          >
            <Icon name="settings" className="text-[18px]" />
          </Link>
          <button
            onClick={() => setLang(lang === "en" ? "sw" : "en")}
            aria-label="Toggle language English or Swahili"
            className="min-h-[36px] px-2.5 py-1.5 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors"
          >
            <span className="font-label-sm text-label-sm text-on-surface font-bold tracking-wide">
              <span className={lang === "en" ? "text-primary-container" : "text-outline"}>EN</span>
              {" | "}
              <span className={lang === "sw" ? "text-primary-container" : "text-outline"}>SW</span>
            </span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors"
            title={`${t("sign_out")} (${fullName})`}
          >
            <span className="font-label-sm text-label-sm font-bold max-w-[70px] truncate">
              {fullName}
            </span>
            <Icon name="logout" className="text-[16px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
