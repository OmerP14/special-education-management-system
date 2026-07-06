"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** Strips leading zeros not followed by a decimal point (e.g. "0100" -> "100", "0.5" untouched). */
function stripLeadingZeros(raw: string): string {
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const stripped = body.replace(/^0+(?=\d)/, "");
  return negative ? `-${stripped}` : stripped;
}

function formatDisplay(value: number | undefined): string {
  if (value === undefined || value === 0) return "";
  return String(value);
}

export interface NumericInputProps
  extends Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  /** Current numeric value. `undefined`/`0` both display as an empty field. */
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** Restored on blur when the field is left empty. Ignored when `allowUndefined` is true. Defaults to 0. */
  emptyValue?: number;
  /** When true, clearing the field keeps the value `undefined` instead of restoring `emptyValue` (e.g. "no custom price set" rather than "priced at 0"). */
  allowUndefined?: boolean;
  /** Applied to the parsed number before it's reported upward (e.g. clamping/rounding). */
  transform?: (value: number) => number;
  /** Parse with parseInt instead of parseFloat (no decimals). */
  integer?: boolean;
}

/**
 * Currency/number input that replaces the raw `<input type="number">` +
 * `parseFloat(e.target.value) || 0` pattern used across the app.
 *
 * Fixes the classic "0" + typed digits => "0100" bug: zero/undefined values
 * display blank, focusing selects existing text so typing replaces it, the
 * field can go empty mid-edit, leading zeros are stripped, and blur restores
 * a sane default (or stays undefined for "unset" fields).
 */
export function NumericInput({
  value,
  onValueChange,
  emptyValue = 0,
  allowUndefined = false,
  transform,
  integer = false,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const [raw, setRaw] = useState(() => formatDisplay(value));
  const isFocused = useRef(false);

  // Sync from external value changes, but never fight the user mid-edit.
  useEffect(() => {
    if (!isFocused.current) setRaw(formatDisplay(value));
  }, [value]);

  const parse = (text: string): number => (integer ? parseInt(text, 10) : parseFloat(text));

  return (
    <Input
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={raw}
      onFocus={(e) => {
        isFocused.current = true;
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const sanitized = stripLeadingZeros(e.target.value);
        setRaw(sanitized);

        if (sanitized === "" || sanitized === "-") {
          onValueChange(allowUndefined ? undefined : 0);
          return;
        }
        const parsed = parse(sanitized);
        if (Number.isNaN(parsed)) return;
        onValueChange(transform ? transform(parsed) : parsed);
      }}
      onBlur={(e) => {
        isFocused.current = false;
        if (raw === "" || raw === "-") {
          if (allowUndefined) {
            onValueChange(undefined);
            setRaw("");
          } else {
            onValueChange(emptyValue);
            setRaw(formatDisplay(emptyValue));
          }
        } else {
          const parsed = parse(raw);
          const finalValue = Number.isNaN(parsed)
            ? emptyValue
            : transform
              ? transform(parsed)
              : parsed;
          onValueChange(finalValue);
          setRaw(formatDisplay(finalValue));
        }
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
