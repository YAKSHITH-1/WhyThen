import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Send,
  Calendar,
  Filter,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitCommit,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { CoverageBadge } from '../components/common/CoverageBadge'
import { CitationCard } from '../components/common/CitationCard'
import { CitationDrawer } from '../components/common/CitationDrawer'
import { searchService } from '../services/searchService'
import { AskRequest, AskResponse, SourceCitation, AnswerMode } from '../types/query'
import { extractErrorMessage, formatDate } from '../lib/utils'

interface ChatMessage {
  id: string
  question: string
  mode: AnswerMode
  dateFrom?: string | null
  dateTo?: string | null
  project?: string | null
  response?: AskResponse
  error?: string
  loading?: boolean
  timestamp: Date
}

export const AskWhyThenView: React.FC = () => {
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [question, setQuestion] = useState(initialQuery)
  const [answerMode, setAnswerMode] = useState<AnswerMode>('standard')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [project, setProject] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Example starter questions
  const exampleQuestions = [
    { text: 'Why did we settle on SQLite instead of PostgreSQL?', mode: 'standard' as AnswerMode },
    { text: 'Trace the architectural decisions between FastAPI and Streamlit', mode: 'decision_history' as AnswerMode },
    { text: 'What unfinished tasks or pending decisions are noted?', mode: 'unfinished_plans' as AnswerMode },
    { text: 'Why was BM25 chosen for keyword retrieval alongside vectors?', mode: 'standard' as AnswerMode },
  ]

  const handleSubmit = async (queryText?: string, modeOverride?: AnswerMode) => {
    const q = (queryText || question).trim()
    if (!q || isLoading) return

    const mode = modeOverride || answerMode
    const msgId = Date.now().toString()

    const newMsg: ChatMessage = {
      id: msgId,
      question: q,
      mode,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      project: project || null,
      loading: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [newMsg, ...prev])
    setQuestion('')
    setIsLoading(true)

    const payload: AskRequest = {
      question: q,
      answer_mode: mode,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      project: project || undefined,
    }

    try {
      const response = await searchService.ask(payload)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId ? { ...msg, response, loading: false } : msg
        )
      )
    } catch (err) {
      const errorMsg = extractErrorMessage(err)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId ? { ...msg, error: errorMsg, loading: false } : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-submit if query param 'q' exists
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      handleSubmit(initialQuery)
    }
  }, [initialQuery])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Ask WhyThen"
        subtitle="Grounded question answering from your notes with source citations and timeline evolution"
        actions={
          messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              Clear History
            </button>
          )
        }
      />

      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        {/* Search & Query Input Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="space-y-3"
          >
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                rows={3}
                placeholder="Ask about past decisions, rationales, meetings, or architectural choices (e.g., 'Why did we change the database choice on Nov 13?')..."
                className="w-full p-3.5 pb-12 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 resize-none font-sans"
              />

              <div className="absolute left-3 bottom-3 flex items-center gap-2">
                {/* Answer Mode Selector */}
                <div className="flex items-center rounded-md bg-white p-0.5 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setAnswerMode('standard')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      answerMode === 'standard'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode('decision_history')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      answerMode === 'decision_history'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Decision History
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerMode('unfinished_plans')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      answerMode === 'unfinished_plans'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Unfinished Plans
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                    showFilters || dateFrom || dateTo || project
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Filters
                  {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="absolute right-3 bottom-3">
                <button
                  type="submit"
                  disabled={isLoading || !question.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-2xs"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Ask WhyThen
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Temporal & Project Filters */}
            {showFilters && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Event Date From (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Event Date To (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Project / Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g. WhyThen, backend"
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded text-slate-800"
                  />
                </div>
              </div>
            )}
          </form>

          {/* Quick Example Prompts (shown when no messages) */}
          {messages.length === 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Sample Inquiries
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exampleQuestions.map((eq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuestion(eq.text)
                      setAnswerMode(eq.mode)
                      handleSubmit(eq.text, eq.mode)
                    }}
                    className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-200 text-xs text-slate-700 transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{eq.text}</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-600 font-medium capitalize">
                      {eq.mode.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Conversation Thread */}
        <div className="space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs"
            >
              {/* Question Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    Q
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{msg.question}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span className="capitalize">Mode: {msg.mode.replace('_', ' ')}</span>
                      {(msg.dateFrom || msg.dateTo) && (
                        <span>
                          Dates: {msg.dateFrom || 'start'} to {msg.dateTo || 'end'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Answer Body */}
              <div className="p-6">
                {msg.loading ? (
                  <div className="space-y-4 py-6">
                    <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span>Synthesizing grounded answer from personal notes...</span>
                    </div>
                    <p className="text-xs text-slate-400 pl-8">
                      Performing hybrid vector similarity and BM25 lexical reranking, followed by local LLM validation.
                    </p>
                  </div>
                ) : msg.error ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Could not complete request:</span>
                    </div>
                    <p className="font-mono">{msg.error}</p>
                    <p className="text-slate-600 pt-1">
                      Tip: Ensure your local Ollama server is running with <code className="bg-rose-100 px-1 py-0.5 rounded">ollama serve</code>, or check your configuration in Settings.
                    </p>
                  </div>
                ) : msg.response ? (
                  <div className="space-y-6">
                    {/* Coverage badge & status header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Grounding Verification:
                        </span>
                        <CoverageBadge coverage={msg.response.coverage} />
                      </div>
                      <span className="text-xs text-slate-400">
                        {msg.response.sources.length} citation(s) referenced
                      </span>
                    </div>

                    {/* Answer Text */}
                    <div className="text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap space-y-2 bg-slate-50/40 p-4 rounded-lg border border-slate-100">
                      {msg.response.answer}
                    </div>

                    {/* Decision Evolution Timeline Items (if present) */}
                    {msg.response.timeline && msg.response.timeline.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <GitCommit className="w-4 h-4 text-purple-600" />
                          Temporal Decision Changes
                        </h4>
                        <div className="space-y-3 pl-2 border-l-2 border-purple-200">
                          {msg.response.timeline.map((item, idx) => (
                            <div key={idx} className="relative pl-4 space-y-1">
                              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-600 border-2 border-white" />
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                  {item.decision}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  {item.status_or_relation}
                                </span>
                                {item.event_date && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(item.event_date)}
                                  </span>
                                )}
                              </div>
                              {item.rationale && (
                                <p className="text-xs text-slate-600 italic">
                                  Rationale: {item.rationale}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Citations */}
                    {msg.response.sources && msg.response.sources.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Grounded Source Excerpts
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {msg.response.sources.map((source, sIdx) => (
                            <CitationCard
                              key={source.chunk_id || sIdx}
                              citation={source}
                              index={sIdx}
                              onClick={(c) => setSelectedCitation(c)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limitations & Evidence Gaps Callout */}
                    {msg.response.limitations && msg.response.limitations.length > 0 && (
                      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Identified Limitations & Knowledge Gaps</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                          {msg.response.limitations.map((lim, lIdx) => (
                            <li key={lIdx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
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
