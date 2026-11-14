import { apiClient } from './api'
import { DecisionTimelineResponse } from '../types/decision'

export const decisionService = {
  async getTimeline(
    topic: string,
    dateFrom?: string | null,
    dateTo?: string | null
  ): Promise<DecisionTimelineResponse> {
    const params: Record<string, string> = { topic }
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo

    const res = await apiClient.get<DecisionTimelineResponse>('/decisions/timeline', {
      params,
    })
    return res.data
  },
}
