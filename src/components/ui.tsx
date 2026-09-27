import { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl shadow-sm p-space-md ${className}`}
    >
      {children}
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "success" | "error" | "warning" | "neutral";
  children: ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    success: "bg-[#ECFDF5] text-[#065F46]",
    error: "bg-error-container text-on-error-container",
    warning: "bg-[#FFFBEB] text-[#92400E]",
    neutral: "bg-surface-container-high text-on-surface-variant",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[52px] bg-secondary text-on-secondary px-space-md py-3 rounded-xl flex items-center justify-center gap-2 font-label-lg text-label-lg font-bold shadow-md active:scale-[0.98] transition-transform disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[52px] bg-primary-container text-surface-container-lowest px-space-md py-3 rounded-xl flex items-center justify-center gap-2 font-label-lg text-label-lg font-bold shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`min-h-[48px] bg-surface-container-lowest text-on-surface border border-outline-variant px-space-md py-2.5 rounded-xl flex items-center justify-center gap-2 font-label-md text-label-md font-bold hover:bg-surface-container transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  swLabel,
  ...props
}: {
  label: string;
  swLabel?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label}
        {swLabel ? <span className="text-outline"> / {swLabel}</span> : null}
      </span>
      <input
        {...props}
        className="min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4 font-body-md text-body-md text-on-surface focus:border-2 focus:border-primary-container focus:outline-none"
      />
    </label>
  );
}

export function SelectField({
  label,
  swLabel,
  children,
  ...props
}: {
  label: string;
  swLabel?: string;
  children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label}
        {swLabel ? <span className="text-outline"> / {swLabel}</span> : null}
      </span>
      <select
        {...props}
        className="min-h-[52px] rounded-xl border border-outline-variant bg-surface-container-lowest px-4 font-body-md text-body-md text-on-surface focus:border-2 focus:border-primary-container focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  swLabel,
  ...props
}: {
  label: string;
  swLabel?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label}
        {swLabel ? <span className="text-outline"> / {swLabel}</span> : null}
      </span>
      <textarea
        {...props}
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md text-on-surface focus:border-2 focus:border-primary-container focus:outline-none"
      />
    </label>
  );
}

export function Money({ amount }: { amount: number }) {
  return (
    <span className="tabular-nums">
      KES {Math.round(amount).toLocaleString("en-KE")}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 font-label-md text-label-md">
      {message}
    </div>
  );
}

export function Spinner() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center py-12 text-on-surface-variant gap-2">
      <Icon name="progress_activity" className="animate-spin" />
      <span className="font-label-md text-label-md">{t("loading")}</span>
    </div>
  );
}

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[rgba(11,19,43,0.4)] px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-space-md flex flex-col gap-space-md shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm">{title}</span>
          <button onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-2 text-on-surface-variant">
      <Icon name={icon} className="text-[40px]" />
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      <p className="font-body-sm text-body-sm max-w-xs">{body}</p>
    </div>
  );
}
