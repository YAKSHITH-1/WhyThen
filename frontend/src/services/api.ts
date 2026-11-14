import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for local LLM inference
  headers: {
    'Content-Type': 'application/json',
  },
})

// Error formatting helper
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.detail) {
      if (typeof error.response.data.detail === 'string') {
        return error.response.data.detail
      }
      return JSON.stringify(error.response.data.detail)
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out after 60 seconds. Ollama or backend may be processing.'
    }
    if (error.response?.status === 404) {
      return 'The requested resource was not found.'
    }
    if (error.response?.status === 500) {
      return 'Internal server error occurred on the backend.'
    }
    return error.message || 'Network request failed'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}
