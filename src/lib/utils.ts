import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPipecatBaseUrl(): string {
  return (process.env.PIPECAT_BASE_URL || 'http://13.201.89.77:7860').replace(/\/+$/, '')
}
