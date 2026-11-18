import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Layers,
  Cpu,
  HardDrive,
  Search,
  ArrowRight,
  Calendar,
  AlertCircle,
  FolderArchive,
  MessageSquareText,
  GitBranch,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { StatusBadge } from '../components/common/StatusBadge'
import { CardSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton'
import { CitationDrawer } from '../components/common/CitationDrawer'
import { EmptyState } from '../components/common/EmptyState'
import { dashboardService } from '../services/dashboardService'
import { searchService } from '../services/searchService'
import { DashboardSummaryResponse } from '../types/dashboard'
import { SourceCitation } from '../types/query'
import { formatBytes, formatDate, formatDateTime, extractErrorMessage } from '../lib/utils'

export const DashboardView: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Quick Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SourceCitation[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Selected citation for drawer
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dashboardService.getSummary()
      setSummary(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const handleQuickSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError(null)
    try {
      const results = await searchService.search({
        text: searchQuery.trim(),
        limit: 4,
      })
      setSearchResults(results)
    } catch (err) {
      setSearchError(extractErrorMessage(err))
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Dashboard"
        subtitle="System metrics, memory overview, and quick note retrieval"
        actions={
          <button
            onClick={fetchSummary}
            className="btn-pill-light"
          >
            <span>Refresh</span>
          </button>
        }
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>Failed to load system dashboard: {error}</span>
          </div>
        )}

        {/* 1. Metric Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Indexed Documents
                </span>
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {summary.total_documents}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span>Notes & files in knowledge base</span>
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Vector Chunks
                </span>
                <Layers className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {summary.total_chunks}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate" title={summary.embedding_model}>
                Model: <span className="font-mono text-slate-700">{summary.embedding_model}</span>
              </p>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Inference Engine
                </span>
                <Cpu className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight truncate">
                {summary.active_llm_model}
              </div>
              <div className="text-xs mt-1 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    summary.ollama_status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="capitalize text-slate-600 font-medium">
                  Ollama {summary.ollama_status}
                </span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Local Storage
                </span>
                <HardDrive className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatBytes(summary.storage_size_bytes)}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate" title={summary.storage_location}>
                SQLite + ChromaDB
              </p>
            </div>
          </div>
        ) : null}

        {/* 2. Quick Search Bar & Direct Retrieval Preview */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-2xs">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Quick Knowledge Search
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify your indexed chunks instantly using hybrid semantic and BM25 search.
            </p>
          </div>

          <form onSubmit={handleQuickSearch} className="mt-4 flex gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search past notes (e.g., 'Why did we choose SQLite?', 'FastAPI vs Streamlit')..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="btn-pill-dark"
            >
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </form>

          {searchError && (
            <p className="text-xs text-rose-600 mt-2 font-medium">{searchError}</p>
          )}

          {/* Quick Search Results Preview */}
          {searchResults && (
            <div className="mt-5 space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Found {searchResults.length} relevant excerpt(s)</span>
                <Link
                  to={`/ask?q=${encodeURIComponent(searchQuery)}`}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  Ask full grounded question <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No matching chunks found in the current index for this query.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map((item, idx) => (
                    <div
                      key={item.chunk_id || idx}
                      onClick={() => setSelectedCitation(item)}
                      className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/20 cursor-pointer transition-all text-left"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {item.title || item.source_path.split(/[\\/]/).pop()}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {Math.round(item.score * 100)}%
                        </span>
                      </div>
                      {item.heading && (
                        <p className="text-[11px] font-medium text-slate-600 mb-1 truncate">
                          {item.heading}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 line-clamp-2 italic">
                        "{item.excerpt}"
                      </p>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(item.event_date || item.document_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Recent Activity & Indexed Documents */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Knowledge Documents</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Recently ingested notes and files available for memory queries
              </p>
            </div>
            <Link
              to="/sources"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              Manage all sources <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={4} />
            </div>
          ) : !summary || summary.recent_documents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FolderArchive}
                title="No indexed documents yet"
                description="Scan your notes directory or upload markdown and text files to enable WhyThen's memory assistant."
                actionLabel="Add Knowledge Sources"
                onAction={() => (window.location.href = '/sources')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Document / Title</th>
                    <th className="py-3 px-5">File Path</th>
                    <th className="py-3 px-4">Event Date</th>
                    <th className="py-3 px-4">Ingested</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recent_documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3.5 px-5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          <span className="truncate max-w-xs">{doc.title || doc.filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px] truncate max-w-sm">
                        {doc.path}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Quick Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/ask"
            className="p-5 bg-white border border-slate-200/80 rounded-xl hover:border-blue-300 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <MessageSquareText className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Ask WhyThen</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ask questions about past decisions, meeting notes, and architecture choices with source citations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-blue-600 group-hover:underline gap-1">
              Start question <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/timeline"
            className="p-5 bg-white border border-slate-200/80 rounded-xl hover:border-purple-300 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <GitBranch className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Decision Timeline</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Trace how choices changed over time, from initial proposals to revisions and superseding choices.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-purple-600 group-hover:underline gap-1">
              View timeline <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/sources"
            className="p-5 bg-white border border-slate-200/80 rounded-xl hover:border-emerald-300 hover:shadow-xs transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FolderArchive className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Knowledge Sources</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Scan local folder repositories or upload markdown notes to update your persistent vector memory.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-emerald-600 group-hover:underline gap-1">
              Manage files <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Citation Detail Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  )
}
