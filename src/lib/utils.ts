import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPipecatBaseUrl(): string {
  return (process.env.PIPECAT_BASE_URL || 'https://ws.pypeai.com').replace(/\/+$/, '')
}
