import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Sayfa bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
        </p>
      </div>
      <Button render={<Link href="/app/dashboard" />}>Panele Dön</Button>
    </div>
  );
}
