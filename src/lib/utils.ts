import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Turkish-aware title case. "ahmet yıldırım" → "Ahmet Yıldırım".
 * Uses tr-TR locale so "i" → "İ" and "ı" → "I" are handled correctly.
 */
export function formatTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(/\s+/)
    .map((word) =>
      word.length === 0
        ? word
        : word[0].toLocaleUpperCase("tr-TR") + word.slice(1).toLocaleLowerCase("tr-TR")
    )
    .join(" ");
}
