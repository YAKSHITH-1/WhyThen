export interface IngestFolderRequest {
  folder_path: string
}

export interface IngestJobResponse {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
}

export interface IngestJobStatus {
  id: string
  job_type: 'folder' | 'upload'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  target_path: string
  total_files: number
  processed_files: number
  error_message?: string | null
  created_at: string
  updated_at: string
}
