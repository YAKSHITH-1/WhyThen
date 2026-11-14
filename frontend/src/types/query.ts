export interface SourceCitation {
  chunk_id: string
  source_path: string
  title?: string | null
  heading?: string | null
  event_date?: string | null
  document_date?: string | null
  excerpt: string
  score: number
}

export interface SearchQuery {
  text: string
  date_from?: string | null
  date_to?: string | null
  project?: string | null
  limit?: number
  semantic_weight?: number
  keyword_weight?: number
  temporal_weight?: number
}

export type AnswerMode = 'standard' | 'decision_history' | 'unfinished_plans'
export type GroundingCoverage = 'supported' | 'partial' | 'no_evidence_found'

export interface AskRequest {
  question: string
  date_from?: string | null
  date_to?: string | null
  project?: string | null
  answer_mode?: AnswerMode
}

export interface AskResponse {
  answer: string
  coverage: GroundingCoverage
  sources: SourceCitation[]
  timeline: Array<{
    event_date?: string | null
    decision: string
    chosen_option?: string | null
    rationale?: string | null
    status_or_relation: string
    citations: SourceCitation[]
  }>
  limitations: string[]
}
