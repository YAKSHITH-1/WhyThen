import { DocumentRecord } from './document'

export interface DashboardSummaryResponse {
  total_documents: number
  total_chunks: number
  active_llm_model: string
  embedding_model: string
  storage_location: string
  storage_size_bytes: number
  recent_documents: DocumentRecord[]
  ollama_status: string
}

export interface HealthStatusResponse {
  status: 'ok' | 'degraded' | 'error'
  app: string
  version: string
  database: string
  ollama: string
}
