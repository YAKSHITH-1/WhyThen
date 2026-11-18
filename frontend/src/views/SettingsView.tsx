import React, { useState, useEffect } from 'react'
import {
  Cpu,
  HardDrive,
  Database,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { settingsService } from '../services/settingsService'
import { dashboardService } from '../services/dashboardService'
import { SettingsPayload, SaveSettingsResponse } from '../types/settings'
import { DashboardSummaryResponse, HealthStatusResponse } from '../types/dashboard'
import { extractErrorMessage } from '../lib/utils'

export const SettingsView: React.FC = () => {
  const [settingsData, setSettingsData] = useState<SettingsPayload | null>(null)
  const [initialSettings, setInitialSettings] = useState<SettingsPayload | null>(null)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [health, setHealth] = useState<HealthStatusResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals
  const [showManualReindexModal, setShowManualReindexModal] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, summaryRes, healthRes] = await Promise.all([
        settingsService.getSettings(),
        dashboardService.getSummary(),
        dashboardService.getHealth().catch(() => null),
      ])
      setSettingsData(settingsRes)
      setInitialSettings(settingsRes)
      setSummary(summaryRes)
      if (healthRes) setHealth(healthRes)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleChange = <K extends keyof SettingsPayload>(
    key: K,
    value: SettingsPayload[K]
  ) => {
    if (!settingsData) return
    setSettingsData({
      ...settingsData,
      [key]: value,
    })
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!settingsData) return

    // Validation
    if (settingsData.chunk_overlap >= settingsData.chunk_size) {
      setError('Chunk overlap must be strictly less than chunk size.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res: SaveSettingsResponse = await settingsService.saveSettings(settingsData)
      setInitialSettings(settingsData)

      if (res.requires_reindex) {
        setSuccessMsg(
          'Settings saved! The embedding model was updated. A re-index was automatically triggered to regenerate chunk vectors.'
        )
      } else {
        setSuccessMsg('Settings saved successfully.')
      }

      // Refresh summary
      const sum = await dashboardService.getSummary()
      setSummary(sum)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleManualReindex = async () => {
    setShowManualReindexModal(false)
    setReindexing(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await settingsService.reindexAll()
      setSuccessMsg(
        `Reindexing complete: Successfully regenerated embeddings for ${res.chunks_reindexed} chunk(s).`
      )
      const sum = await dashboardService.getSummary()
      setSummary(sum)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setReindexing(false)
    }
  }

  const hasEmbeddingChanged =
    initialSettings && settingsData && initialSettings.embedding_model !== settingsData.embedding_model

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Settings & System Diagnostics"
        subtitle="Manage local model endpoints, storage paths, RAG retrieval weights, and system health"
      />

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading || !settingsData ? (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Inference & Embedding Models */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Cpu className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Local Inference & Embeddings
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ollama Host URL
                  </label>
                  <input
                    type="text"
                    value={settingsData.ollama_base_url}
                    onChange={(e) => handleChange('ollama_base_url', e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full text-xs p-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Endpoint of your local Ollama instance.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ollama LLM Model
                  </label>
                  <input
                    type="text"
                    value={settingsData.llm_model}
                    onChange={(e) => handleChange('llm_model', e.target.value)}
                    placeholder="llama3.2"
                    className="w-full text-xs p-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Installed model tag (e.g. <code className="bg-slate-100 px-1 rounded">llama3.2</code>, <code className="bg-slate-100 px-1 rounded">mistral</code>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Embedding Model (HuggingFace / SentenceTransformers)
                  </label>
                  <select
                    value={settingsData.embedding_model}
                    onChange={(e) => handleChange('embedding_model', e.target.value)}
                    className="w-full text-xs p-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (384-dim, fast, default)</option>
                    <option value="BAAI/bge-small-en-v1.5">BAAI/bge-small-en-v1.5 (384-dim)</option>
                    <option value="all-mpnet-base-v2">all-mpnet-base-v2 (768-dim, high quality)</option>
                  </select>
                  {hasEmbeddingChanged && (
                    <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Changing embedding model requires reindexing all chunks.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Top-K Retrieved Chunks
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settingsData.top_k}
                    onChange={(e) => handleChange('top_k', parseInt(e.target.value) || 5)}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Number of context chunks injected into the synthesis prompt.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Storage Paths & Application Defaults */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <HardDrive className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Storage Paths & Preferences
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Knowledge Base Folder
                  </label>
                  <input
                    type="text"
                    value={settingsData.knowledge_base_dir}
                    onChange={(e) => handleChange('knowledge_base_dir', e.target.value)}
                    className="w-full text-xs p-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default folder scanned during one-click indexing.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload Destination Directory
                  </label>
                  <input
                    type="text"
                    value={settingsData.upload_dir}
                    onChange={(e) => handleChange('upload_dir', e.target.value)}
                    className="w-full text-xs p-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sandbox location for files uploaded through the web UI.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Application Timezone
                  </label>
                  <input
                    type="text"
                    value={settingsData.timezone}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    placeholder="UTC"
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Timezone for event date normalization.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Advanced RAG Tuning */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Advanced RAG Retrieval Tuning
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chunk Size (characters)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={2000}
                    value={settingsData.chunk_size}
                    onChange={(e) =>
                      handleChange('chunk_size', parseInt(e.target.value) || 500)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default: 500 characters</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chunk Overlap (characters)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={settingsData.chunk_overlap}
                    onChange={(e) =>
                      handleChange('chunk_overlap', parseInt(e.target.value) || 80)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default: 80 characters</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relevance Cutoff Threshold
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settingsData.relevance_threshold}
                    onChange={(e) =>
                      handleChange('relevance_threshold', parseFloat(e.target.value) || 0.2)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default: 0.20</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semantic Weight
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settingsData.semantic_weight}
                    onChange={(e) =>
                      handleChange('semantic_weight', parseFloat(e.target.value) || 0.5)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Weight for vector similarity</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Keyword (BM25) Weight
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settingsData.keyword_weight}
                    onChange={(e) =>
                      handleChange('keyword_weight', parseFloat(e.target.value) || 0.3)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Weight for lexical BM25</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Temporal Weight
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={settingsData.temporal_weight}
                    onChange={(e) =>
                      handleChange('temporal_weight', parseFloat(e.target.value) || 0.2)
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Weight for recency bias</p>
                </div>
              </div>
            </div>

            {/* 4. System Status & Diagnostics (Read-Only) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Database className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  System Diagnostics & Health
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">App Version</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {health?.version || '0.1.0'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">SQLite Status</span>
                  <span className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5 capitalize">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {health?.database || 'connected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Ollama Engine</span>
                  <span
                    className={`font-medium flex items-center gap-1 mt-0.5 capitalize ${
                      health?.ollama === 'connected' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {health?.ollama === 'connected' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    {health?.ollama || 'checking...'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Indexed Memory</span>
                  <span className="text-slate-900 font-semibold">
                    {summary?.total_documents || 0} docs ({summary?.total_chunks || 0} chunks)
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowManualReindexModal(true)}
                disabled={reindexing}
                className="btn-pill-light !text-amber-700 !border-amber-200 hover:!bg-amber-50"
              >
                {reindexing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Reindexing Chunks...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Trigger Full Re-index
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn-pill-dark"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Manual Reindex Confirmation Modal */}
      <ConfirmModal
        isOpen={showManualReindexModal}
        title="Trigger Full Re-index"
        message="This will read all active chunk texts from SQLite, re-generate dense embeddings with the currently active model, and overwrite the ChromaDB vector index. Continue?"
        confirmText="Start Re-indexing"
        variant="warning"
        onConfirm={handleManualReindex}
        onCancel={() => setShowManualReindexModal(false)}
      />
    </div>
  )
}
