"use client";

import type { ReactNode } from "react";

/*
 * Form controls, built to Apple's text-field and button specs with the brand
 * filled in. docs/design-system.md has the reasoning behind each number.
 *
 * Inputs set 17px text: Safari zooms the page into any field smaller than
 * 16px on focus, which is the single most un-native thing a web form does.
 * Every control is at least 44px tall, the smallest target a thumb can hit.
 */
export const INPUT_CLASSES =
  "min-h-11 w-full rounded-input border border-line bg-surface px-3 py-2 text-body text-ink outline-none placeholder:text-ink-faint transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out)] focus:border-accent focus:ring-4 focus:ring-accent/15 focus-visible:outline-none disabled:opacity-40";

/*
 * The three button looks as class strings, so a link that acts as a button
 * (a Link to /trip/new, say) is drawn exactly like one.
 */
export const PRIMARY_BUTTON_CLASSES =
  "press shine flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 py-2 text-body font-medium text-accent-ink disabled:opacity-40";
export const SECONDARY_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent-soft px-4 py-2 text-subheadline font-medium text-accent-strong disabled:opacity-40";
export const BORDERLESS_BUTTON_CLASSES =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 py-2 text-subheadline font-medium text-accent-strong hover:bg-accent-soft disabled:opacity-40";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-footnote font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-caption text-ink-soft">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASSES} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASSES} resize-y ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLASSES} ${props.className ?? ""}`} />;
}

/**
 * Apple's segmented control: a pill track tinted with the brand, and the
 * chosen segment raised on it as a solid, shadowed pill. The track is 44px
 * tall, and each segment's hit area fills it.
 */
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
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-accent/8 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`press tap h-9 flex-1 rounded-full px-3 text-footnote font-medium ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The one action a screen is for: filled with the brand, full width. */
export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${PRIMARY_BUTTON_CLASSES} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** A supporting action: a translucent wash of the brand under brand-tinted text. */
export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${SECONDARY_BUTTON_CLASSES} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** A quiet action: brand-tinted text only, with a wash under a pointer. */
export function BorderlessButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${BORDERLESS_BUTTON_CLASSES} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
