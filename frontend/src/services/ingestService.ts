import { apiClient } from './api'
import { IngestJobResponse, IngestJobStatus } from '../types/ingest'
import { DocumentListResponse } from '../types/document'

export const ingestService = {
  async ingestFolder(folderPath: string): Promise<IngestJobResponse> {
    const res = await apiClient.post<IngestJobResponse>('/ingest/folder', {
      folder_path: folderPath,
    })
    return res.data
  },

  async uploadFiles(files: File[]): Promise<IngestJobResponse> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const res = await apiClient.post<IngestJobResponse>('/ingest/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },

  async getJobStatus(jobId: string): Promise<IngestJobStatus> {
    const res = await apiClient.get<IngestJobStatus>(`/ingest/jobs/${jobId}`)
    return res.data
  },

  async listDocuments(limit = 100, offset = 0): Promise<DocumentListResponse> {
    const res = await apiClient.get<DocumentListResponse>('/ingest/documents', {
      params: { limit, offset },
    })
    return res.data
  },

  async deleteDocument(docId: string): Promise<{ deleted: boolean; id: string }> {
    const res = await apiClient.delete<{ deleted: boolean; id: string }>(
      `/ingest/documents/${docId}`
    )
    return res.data
  },
}
