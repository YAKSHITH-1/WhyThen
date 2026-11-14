export interface SettingsPayload {
  ollama_base_url: string
  llm_model: string
  embedding_model: string
  knowledge_base_dir: string
  upload_dir: string
  top_k: number
  timezone: string
  chunk_size: number
  chunk_overlap: number
  semantic_weight: number
  keyword_weight: number
  temporal_weight: number
  relevance_threshold: number
}

export interface SaveSettingsResponse {
  message: string
  requires_reindex: boolean
  old_embedding_model?: string
  new_embedding_model?: string
  settings?: SettingsPayload
}

export interface ReindexResponse {
  message: string
  chunks_reindexed: number
}
