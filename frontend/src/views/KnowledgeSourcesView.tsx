import React, { useState, useEffect, useRef } from 'react'
import {
  FolderArchive,
  UploadCloud,
  FolderSearch,
  RefreshCw,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { StatusBadge } from '../components/common/StatusBadge'
import { TableSkeleton } from '../components/common/LoadingSkeleton'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { EmptyState } from '../components/common/EmptyState'
import { ingestService } from '../services/ingestService'
import { DocumentRecord, DocumentListResponse } from '../types/document'
import { IngestJobStatus } from '../types/ingest'
import { formatDate, formatDateTime, extractErrorMessage } from '../lib/utils'

export const KnowledgeSourcesView: React.FC = () => {
  // Folder scanning state
  const [folderPath, setFolderPath] = useState('sample_notes')
  const [folderJobId, setFolderJobId] = useState<string | null>(null)
  const [folderJobStatus, setFolderJobStatus] = useState<IngestJobStatus | null>(null)
  const [isScanningFolder, setIsScanningFolder] = useState(false)

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadJobId, setUploadJobId] = useState<string | null>(null)
  const [uploadJobStatus, setUploadJobStatus] = useState<IngestJobStatus | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Document table state
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 15
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [tableError, setTableError] = useState<string | null>(null)

  // Feedback banner
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  // Delete modal state
  const [docToDelete, setDocToDelete] = useState<DocumentRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch document list
  const fetchDocuments = async (offset = page * pageSize) => {
    setLoadingDocs(true)
    setTableError(null)
    try {
      const res: DocumentListResponse = await ingestService.listDocuments(pageSize, offset)
      setDocuments(res.items)
      setTotalDocs(res.total)
    } catch (err) {
      setTableError(extractErrorMessage(err))
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    fetchDocuments(page * pageSize)
  }, [page])

  // Job Polling Effect for Folder Ingestion
  useEffect(() => {
    if (!folderJobId) return

    let isPolling = true
    const pollInterval = setInterval(async () => {
      try {
        const job = await ingestService.getJobStatus(folderJobId)
        if (!isPolling) return
        setFolderJobStatus(job)

        if (job.status === 'completed') {
          clearInterval(pollInterval)
          setIsScanningFolder(false)
          setBannerMessage({
            type: 'success',
            text: `Folder scan completed: Processed ${job.processed_files} / ${job.total_files} files successfully.`,
          })
          fetchDocuments(0)
          setPage(0)
        } else if (job.status === 'failed') {
          clearInterval(pollInterval)
          setIsScanningFolder(false)
          setBannerMessage({
            type: 'error',
            text: `Folder scan failed: ${job.error_message || 'Unknown ingestion error'}`,
          })
        }
      } catch (err) {
        if (!isPolling) return
        clearInterval(pollInterval)
        setIsScanningFolder(false)
        setBannerMessage({
          type: 'error',
          text: `Polling job status failed: ${extractErrorMessage(err)}`,
        })
      }
    }, 1500)

    return () => {
      isPolling = false
      clearInterval(pollInterval)
    }
  }, [folderJobId])

  // Job Polling Effect for File Upload
  useEffect(() => {
    if (!uploadJobId) return

    let isPolling = true
    const pollInterval = setInterval(async () => {
      try {
        const job = await ingestService.getJobStatus(uploadJobId)
        if (!isPolling) return
        setUploadJobStatus(job)

        if (job.status === 'completed') {
          clearInterval(pollInterval)
          setIsUploading(false)
          setSelectedFiles([])
          setBannerMessage({
            type: 'success',
            text: `Uploaded files indexed: Processed ${job.processed_files} / ${job.total_files} files.`,
          })
          fetchDocuments(0)
          setPage(0)
        } else if (job.status === 'failed') {
          clearInterval(pollInterval)
          setIsUploading(false)
          setBannerMessage({
            type: 'error',
            text: `File indexing failed: ${job.error_message || 'Unknown upload error'}`,
          })
        }
      } catch (err) {
        if (!isPolling) return
        clearInterval(pollInterval)
        setIsUploading(false)
        setBannerMessage({
          type: 'error',
          text: `Polling upload job failed: ${extractErrorMessage(err)}`,
        })
      }
    }, 1500)

    return () => {
      isPolling = false
      clearInterval(pollInterval)
    }
  }, [uploadJobId])

  // Start folder ingestion
  const handleStartFolderScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderPath.trim() || isScanningFolder) return

    setIsScanningFolder(true)
    setFolderJobStatus(null)
    setBannerMessage(null)

    try {
      const res = await ingestService.ingestFolder(folderPath.trim())
      setFolderJobId(res.job_id)
      setBannerMessage({
        type: 'info',
        text: `Scanning dispatched to background worker (Job ID: ${res.job_id.slice(0, 8)}...).`,
      })
    } catch (err) {
      setIsScanningFolder(false)
      setBannerMessage({
        type: 'error',
        text: `Folder scan rejected: ${extractErrorMessage(err)}`,
      })
    }
  }

  // Start multi-file upload
  const handleStartUpload = async () => {
    if (selectedFiles.length === 0 || isUploading) return

    setIsUploading(true)
    setUploadJobStatus(null)
    setBannerMessage(null)

    try {
      const res = await ingestService.uploadFiles(selectedFiles)
      setUploadJobId(res.job_id)
      setBannerMessage({
        type: 'info',
        text: `${selectedFiles.length} file(s) uploaded. Indexing in progress...`,
      })
    } catch (err) {
      setIsUploading(false)
      setBannerMessage({
        type: 'error',
        text: `Upload failed: ${extractErrorMessage(err)}`,
      })
    }
  }

  // Handle document deletion
  const handleConfirmDelete = async () => {
    if (!docToDelete) return
    setIsDeleting(true)
    try {
      await ingestService.deleteDocument(docToDelete.id)
      setBannerMessage({
        type: 'success',
        text: `Document "${docToDelete.title || docToDelete.filename}" removed from SQLite and ChromaDB.`,
      })
      setDocToDelete(null)
      fetchDocuments(page * pageSize)
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: `Failed to delete document: ${extractErrorMessage(err)}`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const totalPages = Math.ceil(totalDocs / pageSize) || 1

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Knowledge Sources"
        subtitle="Manage personal notes directories, upload documents, and inspect real-time indexing status"
        actions={
          <button
            onClick={() => fetchDocuments(page * pageSize)}
            className="btn-pill-light"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner notification */}
        {bannerMessage && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : bannerMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : bannerMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1. Ingestion Control Cards (Folder Scan & File Upload) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: Folder Scanner */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderSearch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Local Folder Scanner</h3>
                  <p className="text-xs text-slate-500">
                    Scan directory of Markdown (.md) and text (.txt) notes
                  </p>
                </div>
              </div>

              <form onSubmit={handleStartFolderScan} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Folder Path (Relative or Approved Absolute)
                  </label>
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="e.g. sample_notes"
                    disabled={isScanningFolder}
                    className="w-full text-xs p-2.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Incremental indexing skips unchanged files automatically based on SHA-256 hashes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isScanningFolder || !folderPath.trim()}
                  className="w-full btn-pill-dark !py-2.5"
                >
                  {isScanningFolder ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Scanning in background...
                    </>
                  ) : (
                    <>
                      <FolderSearch className="w-3.5 h-3.5" />
                      Scan & Index Folder
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Folder Ingestion Progress Bar */}
            {folderJobStatus && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-600 font-medium">
                  <span className="capitalize">Status: {folderJobStatus.status}</span>
                  <span>
                    {folderJobStatus.processed_files} / {folderJobStatus.total_files} files
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      folderJobStatus.status === 'completed'
                        ? 'bg-emerald-500'
                        : folderJobStatus.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${
                        folderJobStatus.total_files > 0
                          ? Math.round(
                              (folderJobStatus.processed_files / folderJobStatus.total_files) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card B: Multi-File Upload */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Upload Files</h3>
                  <p className="text-xs text-slate-500">
                    Upload individual notes directly into managed storage (<code className="bg-slate-100 px-1 py-0.5 rounded">data/uploads</code>)
                  </p>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 p-5 border-2 border-dashed border-slate-200 hover:border-emerald-300 rounded-xl bg-slate-50/50 hover:bg-emerald-50/20 cursor-pointer transition-all text-center"
              >
                <UploadCloud className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Click to select Markdown or Text files
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supported formats: .md, .txt (max 25MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".md,.txt,text/plain,text/markdown"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files))
                    }
                  }}
                  className="hidden"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    {selectedFiles.length} file(s) selected
                  </span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-slate-400 hover:text-slate-600 text-[11px]"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="w-full btn-pill-dark !py-2.5"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Uploading & Indexing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload & Index {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
                  </>
                )}
              </button>

              {/* Upload Progress Bar */}
              {uploadJobStatus && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600 font-medium">
                    <span className="capitalize">Status: {uploadJobStatus.status}</span>
                    <span>
                      {uploadJobStatus.processed_files} / {uploadJobStatus.total_files} files
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        uploadJobStatus.status === 'completed'
                          ? 'bg-emerald-500'
                          : uploadJobStatus.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{
                        width: `${
                          uploadJobStatus.total_files > 0
                            ? Math.round(
                                (uploadJobStatus.processed_files / uploadJobStatus.total_files) * 100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Documents Management Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Indexed Memory Documents ({totalDocs})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full list of documents registered in SQLite and vectorized in ChromaDB
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Page {page + 1} of {totalPages}
            </div>
          </div>

          {loadingDocs ? (
            <div className="p-5">
              <TableSkeleton rows={6} />
            </div>
          ) : tableError ? (
            <div className="p-6 text-center text-xs text-rose-600">
              Failed to load documents: {tableError}
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FolderArchive}
                title="No documents indexed"
                description="Use the folder scanner or file upload above to ingest your first documents."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Document / Title</th>
                    <th className="py-3 px-5">File Path</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-4">Event Date</th>
                    <th className="py-3 px-4">Ingested At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                          <span className="truncate max-w-xs">{doc.title || doc.filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px] truncate max-w-sm">
                        {doc.path}
                      </td>
                      <td className="py-3.5 px-3 uppercase text-[10px] font-mono text-slate-500">
                        {doc.file_type}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(doc.document_date)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatDateTime(doc.ingested_at)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setDocToDelete(doc)}
                          title="Delete document and associated chunks"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination bar */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {documents.length > 0 ? page * pageSize + 1 : 0} to{' '}
              {Math.min((page + 1) * pageSize, totalDocs)} of {totalDocs} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-pill-light !py-1 !px-3"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-pill-light !py-1 !px-3"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${
          docToDelete?.title || docToDelete?.filename
        }"? This will delete the document metadata from SQLite and permanently purge all associated chunks from the ChromaDB vector collection.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  )
}
