import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalizeWords(s: string): string {
  return s.replace(/(^|\s)\S/g, c => c.toUpperCase());
}
