"use client";

import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SettingsFieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + helper/error text, consistent across every settings
 *  form — this is the one place that styling lives, instead of every section
 *  page re-implementing its own label/error markup. */
export function SettingsField({
  label,
  htmlFor,
  description,
  error,
  required,
  className,
  children,
}: SettingsFieldProps) {
  // Without an explicit htmlFor, link the label to a single child control by
  // giving it a generated id, so clicking the label focuses it and screen
  // readers announce the field name.
  const autoId = useId();
  const child = isValidElement<{ id?: string }>(children) ? children : null;
  const controlId = htmlFor ?? child?.props.id ?? (child ? autoId : undefined);
  const control = !htmlFor && child && !child.props.id ? cloneElement(child, { id: autoId }) : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {control}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
