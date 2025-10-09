// src/types/email-notifications.ts

export type EmailNotificationType = 'agent_permission' | 'phone_number_request'

export interface EmailNotificationRequest {
  type: EmailNotificationType
  description?: string
}

export interface EmailSendResult {
  success: boolean
  email: string
  messageId?: string
  error?: string
}

export interface EmailNotificationResponse {
  success: boolean
  message: string
  results: EmailSendResult[]
  failedSends?: EmailSendResult[]
}