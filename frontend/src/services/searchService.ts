import { apiClient } from './api'
import { SearchQuery, SourceCitation, AskRequest, AskResponse } from '../types/query'

export const searchService = {
  async search(query: SearchQuery): Promise<SourceCitation[]> {
    const res = await apiClient.post<SourceCitation[]>('/search', query)
    return res.data
  },

  async ask(request: AskRequest): Promise<AskResponse> {
    const res = await apiClient.post<AskResponse>('/ask', request)
    return res.data
  },
}
