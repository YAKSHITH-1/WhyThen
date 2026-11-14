import React from 'react'
import { FileText, Calendar, ExternalLink } from 'lucide-react'
import { SourceCitation } from '../../types/query'
import { formatDate } from '../../lib/utils'

interface CitationCardProps {
  citation: SourceCitation
  index?: number
  onClick?: (citation: SourceCitation) => void
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index, onClick }) => {
  const displayDate = citation.event_date || citation.document_date
  const scorePercent = Math.round((citation.score || 0) * 100)

  return (
    <div
      onClick={() => onClick?.(citation)}
      className="group relative flex flex-col justify-between p-3.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer text-left"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
              {index !== undefined ? index + 1 : '§'}
            </span>
            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span
              className="text-xs font-semibold text-slate-800 truncate"
              title={citation.title || citation.source_path}
            >
              {citation.title || citation.source_path.split(/[\\/]/).pop()}
            </span>
          </div>
          {scorePercent > 0 && (
            <span
              className="text-[10px] font-mono font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0"
              title={`Relevance score: ${citation.score.toFixed(3)}`}
            >
              {scorePercent}% match
            </span>
          )}
        </div>

        {citation.heading && (
          <p className="text-[11px] font-medium text-slate-600 mb-1.5 truncate">
            {citation.heading}
          </p>
        )}

        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-sans bg-slate-50/50 p-2 rounded border border-slate-100">
          "{citation.excerpt}"
        </p>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{displayDate ? formatDate(displayDate) : 'No date'}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-blue-600 font-medium group-hover:underline">
          View Details
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </div>
  )
}
