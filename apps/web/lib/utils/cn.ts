import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn class-merging helper. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
