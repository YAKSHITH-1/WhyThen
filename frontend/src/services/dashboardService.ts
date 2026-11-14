import { apiClient } from './api'
import { DashboardSummaryResponse, HealthStatusResponse } from '../types/dashboard'

export const dashboardService = {
  async getSummary(): Promise<DashboardSummaryResponse> {
    const res = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary')
    return res.data
  },

  async getHealth(): Promise<HealthStatusResponse> {
    const res = await apiClient.get<HealthStatusResponse>('/health')
    return res.data
  },
}
