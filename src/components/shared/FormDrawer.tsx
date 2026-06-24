"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saveLabel = "Kaydet",
  saving = false,
}: FormDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen: boolean) => onOpenChange(isOpen)}>
      <SheetContent side="right" showCloseButton className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-5 pt-5 pb-4">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <Separator />
        <SheetFooter className="flex flex-row justify-end gap-2 px-5 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Vazgeç
          </Button>
          {onSave && (
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Kaydediliyor…" : saveLabel}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
