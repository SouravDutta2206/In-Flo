import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge class names conditionally with Tailwind-aware deduplication.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a token count for compact display (e.g. 2500 → "2.5k").
 */
export function formatTokens(tokens: number) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Check whether a File object is a PDF based on its filename extension.
 */
export function isPdfFile(file: File) {
  return file.name.toLowerCase().endsWith(".pdf")
}
