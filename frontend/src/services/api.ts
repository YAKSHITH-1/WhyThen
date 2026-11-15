import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 180000, // 180s (3m) for local LLM inference on CPU/GPU
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
      return 'Request timed out. Local CPU inference may take up to 90-120 seconds. Please try again or check your Ollama configuration.'
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
