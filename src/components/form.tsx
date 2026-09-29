"use client";

import type { ReactNode } from "react";

const CONTROL =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent";

export function Field({
  label,
  hint,
  error,
  group = false,
  children,
}: {
  label: string;
  hint?: string;
  /** What is wrong with the value, shown in place of the hint. */
  error?: string;
  /**
   * For a control that labels itself, like a Segmented group. Wrapped in a
   * <label>, its first button would take the label's text as its own name.
   */
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[11px] text-critical">{error}</span>
      ) : (
        hint && <span className="text-[11px] text-ink-faint">{hint}</span>
      )}
    </Tag>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} resize-y ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`press flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`press shine w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`press rounded-xl border border-line px-3.5 py-2 text-sm text-ink-soft disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
