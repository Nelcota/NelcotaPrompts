import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Junta classes (condicionais com clsx) e resolve conflitos do Tailwind: a última vence
// (ex.: "hover:bg-ink/5" + "hover:bg-danger/10" fica só com a de danger).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
