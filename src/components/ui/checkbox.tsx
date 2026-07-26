"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "checked" | "onCheckedChange"> & {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
}) {
  const { checked, onCheckedChange, ...rest } = props
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked === "indeterminate" ? false : checked}
      indeterminate={checked === "indeterminate"}
      onCheckedChange={(next) => onCheckedChange?.(next)}
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input bg-background outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        className
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {checked === "indeterminate" ? <MinusIcon className="size-3" /> : <CheckIcon className="size-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
