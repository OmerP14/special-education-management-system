"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

/** RouteGuard's redirect target for "authenticated but not authorized to see
 *  this route" — distinct from an unauthenticated visit, which goes to
 *  /login instead. See RouteGuard.tsx. */
export default function ForbiddenPage() {
  const { role } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Bu sayfaya erişim yetkiniz yok</h1>
        <p className="text-sm text-muted-foreground">
          {role
            ? `"${role.name}" rolünüz bu sayfayı görüntülemek için yeterli yetkiye sahip değil.`
            : "Bu sayfayı görüntülemek için yeterli yetkiye sahip değilsiniz."}
        </p>
      </div>
      <Button render={<Link href="/app/dashboard" />}>Panele Dön</Button>
    </div>
  );
}
