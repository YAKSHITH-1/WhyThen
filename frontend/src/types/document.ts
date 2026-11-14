export type DocumentStatus = 'indexed' | 'modified' | 'removed' | 'failed'

export interface DocumentRecord {
  id: string
  path: string
  filename: string
  content_hash: string
  file_type: string
  title?: string | null
  document_date?: string | null
  modified_at: string
  ingested_at: string
  status: DocumentStatus
}

export interface DocumentListResponse {
  items: DocumentRecord[]
  total: number
  limit: number
  offset: number
}
