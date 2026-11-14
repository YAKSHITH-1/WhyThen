import { apiClient } from './api'
import { SettingsPayload, SaveSettingsResponse, ReindexResponse } from '../types/settings'

export const settingsService = {
  async getSettings(): Promise<SettingsPayload> {
    const res = await apiClient.get<SettingsPayload>('/settings')
    return res.data
  },

  async saveSettings(payload: SettingsPayload): Promise<SaveSettingsResponse> {
    const res = await apiClient.post<SaveSettingsResponse>('/settings', payload)
    return res.data
  },

  async reindexAll(): Promise<ReindexResponse> {
    const res = await apiClient.post<ReindexResponse>('/settings/reindex')
    return res.data
  },
}
