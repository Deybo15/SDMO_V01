import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function formatCurrency(amount: number, currency: 'CRC' | 'USD') {
    return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatDateOnly(
  value: string | null | undefined
): string {
  if (!value) return "—";

  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-");

  if (!year || !month || !day || year.length !== 4) return "—";

  return `${day}/${month}/${year}`;
}

