import React, { useState } from 'react'
import { X, Copy, Check, FileText, Calendar, Compass, Hash } from 'lucide-react'
import { SourceCitation } from '../../types/query'
import { formatDate } from '../../lib/utils'

interface CitationDrawerProps {
  citation: SourceCitation | null
  onClose: () => void
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citation, onClose }) => {
  const [copied, setCopied] = useState(false)

  if (!citation) return null

  const handleCopyChunkId = () => {
    navigator.clipboard.writeText(citation.chunk_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filename = citation.source_path.split(/[\\/]/).pop() || citation.source_path

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="relative w-full max-w-lg bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Source Citation Evidence</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Document metadata block */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Document Title
              </span>
              <p className="text-sm font-medium text-slate-900 mt-0.5">
                {citation.title || filename}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Source File Path
              </span>
              <p className="text-xs font-mono text-slate-600 mt-0.5 break-all bg-white p-2 rounded border border-slate-200">
                {citation.source_path}
              </p>
            </div>

            {citation.heading && (
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Section Heading
                </span>
                <p className="text-xs font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  {citation.heading}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Event Date
                </span>
                <p className="text-xs text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(citation.event_date)}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Relevance Score
                </span>
                <p className="text-xs font-mono font-medium text-blue-600 mt-0.5">
                  {(citation.score * 100).toFixed(1)}% match
                </p>
              </div>
            </div>
          </div>

          {/* Full Excerpt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Grounded Excerpt
              </span>
              <span className="text-xs text-slate-400">Verbatim chunk content</span>
            </div>
            <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-lg text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
              {citation.excerpt}
            </div>
          </div>

          {/* Chunk ID */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Vector Chunk Identifier
            </span>
            <div className="flex items-center justify-between mt-1 p-2 bg-slate-100 rounded border border-slate-200 font-mono text-xs text-slate-600">
              <span className="flex items-center gap-1.5 truncate">
                <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{citation.chunk_id}</span>
              </span>
              <button
                onClick={handleCopyChunkId}
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded shadow-2xs hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
