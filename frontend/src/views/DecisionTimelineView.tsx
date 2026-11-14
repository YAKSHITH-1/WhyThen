import React, { useState } from 'react'
import {
  GitBranch,
  Calendar,
  Search,
  AlertCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  Sparkles,
  RefreshCw,
  GitCommit,
  CheckCircle,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { CitationDrawer } from '../components/common/CitationDrawer'
import { EmptyState } from '../components/common/EmptyState'
import { CardSkeleton } from '../components/common/LoadingSkeleton'
import { decisionService } from '../services/decisionService'
import { DecisionTimelineResponse } from '../types/decision'
import { SourceCitation } from '../types/query'
import { formatDate, extractErrorMessage } from '../lib/utils'

export const DecisionTimelineView: React.FC = () => {
  const [topic, setTopic] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timelineData, setTimelineData] = useState<DecisionTimelineResponse | null>(null)

  // Drawer state
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null)

  const quickTopics = ['Database', 'Architecture', 'Retrieval', 'FastAPI', 'Frontend']

  const handleFetchTimeline = async (searchTopic?: string) => {
    const t = (searchTopic || topic).trim()
    if (!t) return

    setLoading(true)
    setError(null)
    try {
      const data = await decisionService.getTimeline(
        t,
        dateFrom || undefined,
        dateTo || undefined
      )
      setTimelineData(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const getRelationBadge = (relation: string) => {
    switch (relation.toLowerCase()) {
      case 'supersedes':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <GitCommit className="w-3 h-3" />
            Supersedes Previous
          </span>
        )
      case 'revises':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            Revises Choice
          </span>
        )
      case 'confirms':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            Confirms Direction
          </span>
        )
      case 'unfinished_plan':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            Unfinished Plan
          </span>
        )
      case 'proposal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <HelpCircle className="w-3 h-3 text-blue-500" />
            Proposal / Candidate
          </span>
        )
      case 'initial_choice':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <Sparkles className="w-3 h-3" />
            Initial Decision
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Decision Timeline"
        subtitle="Chronological visualization of technical decisions, their reasoning, and subsequent changes"
      />

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Search & Topic Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleFetchTimeline()
            }}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter decision topic or entity (e.g. 'Database choice', 'Frontend framework', 'FastAPI')..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="Date From"
                  className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="Date To"
                  className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                />
                <button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  className="px-5 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-2xs flex items-center gap-1.5 flex-shrink-0"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Reconstructing...
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-3.5 h-3.5" />
                      Trace Decisions
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] font-medium text-slate-400">Popular Topics:</span>
              {quickTopics.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => {
                    setTopic(qt)
                    handleFetchTimeline(qt)
                  }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 hover:border-purple-200 text-slate-600 transition-colors"
                >
                  {qt}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>Failed to load timeline: {error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {/* Empty State */}
        {!loading && !timelineData && (
          <EmptyState
            icon={GitBranch}
            title="Trace the evolution of your choices"
            description="Enter a topic above to reconstruct a chronological narrative showing why choices were made, what alternatives were considered, and when decisions changed."
          />
        )}

        {/* Timeline Results */}
        {!loading && timelineData && (
          <div className="space-y-6">
            {/* Topic Summary Card */}
            <div className="p-5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                  Topic Synthesis: {timelineData.topic}
                </span>
                <span className="text-xs text-purple-600 font-medium">
                  {timelineData.timeline.length} Decision Point(s)
                </span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed font-sans">
                {timelineData.summary}
              </p>
            </div>

            {/* Vertical Timeline Stream */}
            {timelineData.timeline.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500 text-xs">
                No recorded decisions or milestones found for topic "{timelineData.topic}".
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 border-l-2 border-purple-200 space-y-8 my-6">
                {timelineData.timeline.map((item, index) => (
                  <div key={index} className="relative group">
                    {/* Circle Node */}
                    <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-purple-600 group-hover:scale-110 transition-transform shadow-xs" />

                    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-purple-200 transition-all space-y-3">
                      {/* Top Bar: Date & Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-900">
                            {formatDate(item.event_date)}
                          </span>
                        </div>
                        {getRelationBadge(item.status_or_relation)}
                      </div>

                      {/* Decision Details */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-1">
                          {item.decision}
                        </h4>
                        {item.chosen_option && (
                          <div className="text-xs text-slate-600 font-medium mb-2">
                            Chosen Option:{' '}
                            <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {item.chosen_option}
                            </span>
                          </div>
                        )}
                        {item.rationale && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-800">Why: </span>
                            {item.rationale}
                          </div>
                        )}
                      </div>

                      {/* Citations List */}
                      {item.citations && item.citations.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Source Grounding
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.citations.map((cite, cIdx) => (
                              <button
                                key={cite.chunk_id || cIdx}
                                onClick={() => setSelectedCitation(cite)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-800 rounded text-xs border border-slate-200 hover:border-purple-200 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                                <span className="font-medium truncate max-w-xs">
                                  {cite.title || cite.source_path.split(/[\\/]/).pop()}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unresolved Questions */}
            {timelineData.unresolved_questions && timelineData.unresolved_questions.length > 0 && (
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Unresolved Questions & Pending Ambiguities</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 pl-1">
                  {timelineData.unresolved_questions.map((q, qIdx) => (
                    <li key={qIdx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Citation Detail Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  )
}
