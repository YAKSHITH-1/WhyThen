import { SourceCitation } from './query'

export type DecisionRelation = 'initial_choice' | 'revises' | 'supersedes' | 'confirms'

export interface DecisionTimelineItem {
  event_date?: string | null
  decision: string
  chosen_option?: string | null
  rationale?: string | null
  status_or_relation: DecisionRelation | string
  citations: SourceCitation[]
}

export interface DecisionTimelineResponse {
  topic: string
  summary: string
  timeline: DecisionTimelineItem[]
  unresolved_questions: string[]
}
