"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription,
  className,
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    );
  }

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 bg-muted hover:bg-muted">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                  col.headerClassName
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={keyExtractor(row)}
              className={cn(
                "border-border transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted/40"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("py-3.5 text-sm", col.className)}
                >
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
