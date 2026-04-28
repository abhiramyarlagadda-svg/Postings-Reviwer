import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Merges Tailwind classes safely, resolving conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Returns true if the value is defined and not null
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}
