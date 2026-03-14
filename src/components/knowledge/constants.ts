/**
 * Allowed file types for RAG knowledge base uploads.
 * Backend should support these MIME types and extensions.
 */
export const KNOWLEDGE_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.csv',
] as const

export const KNOWLEDGE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
] as const

export const KNOWLEDGE_MAX_FILE_SIZE_MB = 20
export const KNOWLEDGE_MAX_FILE_SIZE_BYTES = KNOWLEDGE_MAX_FILE_SIZE_MB * 1024 * 1024

export function isAllowedKnowledgeFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const hasExtension = KNOWLEDGE_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  const hasMime = KNOWLEDGE_ALLOWED_MIME_TYPES.includes(file.type as (typeof KNOWLEDGE_ALLOWED_MIME_TYPES)[number])
  return hasExtension || hasMime
}

export function getKnowledgeFileTypeLabel(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.txt')) return 'Text'
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'Word'
  if (lower.endsWith('.csv')) return 'CSV'
  return 'Document'
}
