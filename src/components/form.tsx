"use client";

import type { ReactNode } from "react";
import {
  BORDERLESS_BUTTON_CLASSES,
  DESTRUCTIVE_BUTTON_CLASSES,
  INPUT_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  REMOVE_BUTTON_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "./styles";

/*
 * The shared form controls. Their looks live in styles.ts, so links and
 * server components can share them.
 */

export function Field({
  label,
  hint,
  error,
  group = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Shown in place of the hint, in the critical tone, while the value is wrong. */
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
    <Tag className="flex flex-col gap-2">
      <span className="text-footnote font-medium text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span className="text-caption text-critical">{error}</span>
      ) : (
        hint && <span className="text-caption text-ink-soft">{hint}</span>
      )}
    </Tag>
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

/** Deleting or replacing something: the tinted shape in the critical tone. */
export function DestructiveButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`${DESTRUCTIVE_BUTTON_CLASSES} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function RemoveButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`${REMOVE_BUTTON_CLASSES} ${props.className ?? ""}`}>
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
