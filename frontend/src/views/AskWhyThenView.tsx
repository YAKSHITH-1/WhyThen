import React, { useState, useEffect, useMemo } from 'react'
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
  Sparkles,
  ArrowUp,
  Compass,
  RotateCcw,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { AsciiCanvas, CreatureType } from '../components/common/AsciiCanvas'
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

  // ASCII Creature selection (jellyfish by default, matching video)
  const [creatureType, setCreatureType] = useState<CreatureType>('jellyfish')

  // Dynamic time-based greeting (replaces hardcoded names like "Stephen")
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 22 || hour < 5) {
      return {
        title: 'Still up?',
        subtitle: 'What past decision are we exploring tonight?',
      }
    } else if (hour >= 5 && hour < 12) {
      return {
        title: 'Good morning.',
        subtitle: 'What architectural rationale shall we review?',
      }
    } else if (hour >= 12 && hour < 17) {
      return {
        title: 'Good afternoon.',
        subtitle: 'Ask WhyThen anything about your project notes.',
      }
    } else {
      return {
        title: 'Good evening.',
        subtitle: 'Revisit any decision timeline or pending plans.',
      }
    }
  }, [])

  // Sample prompt chips matching the project's real decision history
  const exampleQuestions = [
    {
      text: 'Why did we migrate away from Streamlit to React in September?',
      mode: 'standard' as AnswerMode,
      tag: 'Architecture',
    },
    {
      text: 'Why did we settle on SQLite instead of PostgreSQL?',
      mode: 'standard' as AnswerMode,
      tag: 'Database',
    },
    {
      text: 'What unfinished tasks or pending decisions are noted?',
      mode: 'unfinished_plans' as AnswerMode,
      tag: 'Roadmap',
    },
    {
      text: 'Trace the architectural evolution of WhyThen in 2026',
      mode: 'decision_history' as AnswerMode,
      tag: 'Timeline',
    },
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

  // Helper to highlight citations in raw answer text
  const renderHighlightedAnswer = (answerText: string) => {
    const parts = answerText.split(/(\[Excerpt [^\]]+\]|\[[^\]]+_c\d+\])/g)
    return parts.map((part, idx) => {
      if (/^(\[Excerpt [^\]]+\]|\[[^\]]+_c\d+\])$/.test(part)) {
        return (
          <span
            key={idx}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold"
          >
            {part}
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }

  return (
    <div className="relative flex-1 flex flex-col min-w-0 bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* 1. Background ASCII Creature Simulation Canvas */}
      <div className="absolute inset-0 z-0">
        <AsciiCanvas
          creatureType={creatureType}
          onCreatureChange={setCreatureType}
          showControls={messages.length === 0}
        />
      </div>

      {/* 2. Top Header Bar (when in active conversation) */}
      {messages.length > 0 && (
        <header className="relative z-10 flex items-center justify-between px-6 py-3.5 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h1 className="text-sm font-semibold text-white tracking-wide">
                Ask WhyThen
              </h1>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              • {messages.length} question{messages.length > 1 ? 's' : ''} asked
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Creature Switcher in header */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs">
              {(
                [
                  { id: 'jellyfish', label: 'Jellyfish', color: 'bg-fuchsia-500' },
                  { id: 'dragonfly', label: 'Dragonfly', color: 'bg-emerald-400' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCreatureType(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    creatureType === item.id
                      ? 'glass-surface-active'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMessages([])}
              className="btn-pill-dark !py-1.5 !px-3.5 !text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Canvas Mode</span>
            </button>
          </div>
        </header>
      )}

      {/* 3. Main Stage */}
      {messages.length === 0 ? (
        /* HERO VIEW: Matching the user's video with centered greeting, glowing emblem, and search bar */
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 min-h-0 pointer-events-none">
          <div className="w-full max-w-2xl flex flex-col items-center space-y-6 pointer-events-auto">
            {/* Glowing WhyThen Decision Emblem */}
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600 via-fuchsia-500 to-indigo-600 rounded-full blur-md opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-slate-950/90 border border-slate-700/80 flex items-center justify-center shadow-2xl backdrop-blur-md">
                <Sparkles className="w-7 h-7 text-blue-400" />
              </div>
            </div>

            {/* Dynamic Contextual Greeting */}
            <div className="text-center space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                {greeting.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-sans">
                {greeting.subtitle}
              </p>
            </div>

            {/* Centered Glassmorphic Command Search Bar */}
            <div className="w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-700/70 rounded-2xl shadow-2xl shadow-black/80 hover:border-slate-600/90 transition-all p-4 space-y-3">
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
                    rows={2}
                    placeholder="Ask about past decisions, rationales, meetings, or architectural notes..."
                    className="w-full p-2.5 text-sm sm:text-base bg-transparent border-0 focus:outline-none text-white placeholder:text-slate-400 resize-none font-sans"
                    autoFocus
                  />
                </div>

                {/* Bottom Row inside search bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {/* Mode Selector Pill */}
                    <div className="flex items-center rounded-full bg-slate-950/80 p-1 border border-slate-800 text-xs gap-1">
                      <button
                        type="button"
                        onClick={() => setAnswerMode('standard')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          answerMode === 'standard'
                            ? 'btn-pill-light !py-1 !px-3 !text-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswerMode('decision_history')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          answerMode === 'decision_history'
                            ? 'btn-pill-light !py-1 !px-3 !text-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Timeline
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswerMode('unfinished_plans')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          answerMode === 'unfinished_plans'
                            ? 'btn-pill-light !py-1 !px-3 !text-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Plans
                      </button>
                    </div>

                    {/* Filter Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      className="btn-pill-dark !py-1.5 !px-3 !text-xs"
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filters</span>
                      {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Circular Up-Arrow Send Button matching the video */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      ↵ Enter
                    </span>
                    <button
                      type="submit"
                      disabled={isLoading || !question.trim()}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        question.trim() && !isLoading
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-100 hover:scale-105 active:scale-95'
                          : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <ArrowUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Temporal Filters */}
                {showFilters && (
                  <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Date From
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full text-xs p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Date To
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full text-xs p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Project / Tag
                      </label>
                      <input
                        type="text"
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder="e.g. backend"
                        className="w-full text-xs p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Quick Prompt Chips */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono uppercase tracking-wider pl-1">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>Exploration Suggestions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exampleQuestions.map((eq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuestion(eq.text)
                      setAnswerMode(eq.mode)
                      handleSubmit(eq.text, eq.mode)
                    }}
                    className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.22] text-left transition-all group backdrop-blur-md flex items-center justify-between shadow-sm active:scale-[0.99]"
                  >
                    <span className="text-xs text-slate-300 group-hover:text-white line-clamp-1 pr-2">
                      {eq.text}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/15 shrink-0">
                      {eq.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CONVERSATION VIEW: Answers, Source Citations, Timeline & Persistent Follow-up Bar */
        <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6 pb-32">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl transition-all"
              >
                {/* Question Header */}
                <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-600/30">
                      Q
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {msg.question}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 font-mono">
                        <span className="capitalize">
                          Mode: {msg.mode.replace('_', ' ')}
                        </span>
                        {(msg.dateFrom || msg.dateTo) && (
                          <span>
                            Dates: {msg.dateFrom || 'start'} to {msg.dateTo || 'end'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Answer Content */}
                <div className="p-5 sm:p-6 space-y-5">
                  {msg.loading ? (
                    <div className="py-8 space-y-4">
                      <div className="flex items-center gap-3 text-sm text-slate-200 font-medium">
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                        <span>Synthesizing grounded answer from personal notes...</span>
                      </div>
                      <p className="text-xs text-slate-400 pl-8 leading-relaxed">
                        Performing hybrid vector similarity and BM25 lexical reranking, followed by local Ollama generation (~45–60s on CPU).
                      </p>
                    </div>
                  ) : msg.error ? (
                    <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-200 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Could not complete request:</span>
                      </div>
                      <p className="font-mono text-rose-300">{msg.error}</p>
                      <p className="text-slate-400 pt-1">
                        Tip: Ensure local Ollama is active with{' '}
                        <code className="bg-rose-900/60 px-1 py-0.5 rounded text-rose-200 font-mono">
                          ollama serve
                        </code>
                        .
                      </p>
                    </div>
                  ) : msg.response ? (
                    <div className="space-y-6">
                      {/* Grounding Verification Header */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Grounding:
                          </span>
                          <CoverageBadge coverage={msg.response.coverage} />
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {msg.response.sources.length} citation(s) linked
                        </span>
                      </div>

                      {/* Answer Body with highlighted citations */}
                      <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        {renderHighlightedAnswer(msg.response.answer)}
                      </div>

                      {/* Decision Timeline Evolution (if synthesized) */}
                      {msg.response.timeline && msg.response.timeline.length > 0 && (
                        <div className="pt-2">
                          <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <GitCommit className="w-4 h-4" />
                            Temporal Decision Evolution
                          </h4>
                          <div className="space-y-3 pl-3 border-l-2 border-purple-500/40">
                            {msg.response.timeline.map((item, idx) => (
                              <div key={idx} className="relative pl-4 space-y-1">
                                <span className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-slate-900" />
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-white">
                                    {item.decision}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                                    {item.status_or_relation}
                                  </span>
                                  {item.event_date && (
                                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                                      <Calendar className="w-3 h-3 text-slate-500" />
                                      {formatDate(item.event_date)}
                                    </span>
                                  )}
                                </div>
                                {item.rationale && (
                                  <p className="text-xs text-slate-400 italic">
                                    Rationale: {item.rationale}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grounded Source Citations */}
                      {msg.response.sources && msg.response.sources.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Layers className="w-4 h-4" />
                            Grounded Excerpt Citations
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

                      {/* Limitations & Gaps */}
                      {msg.response.limitations && msg.response.limitations.length > 0 && (
                        <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-200 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>Identified Limitations & Knowledge Gaps</span>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
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

          {/* Floating Bottom Follow-up Input Bar */}
          <div className="fixed bottom-5 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
            <div className="w-full max-w-2xl glass-surface-active !rounded-full p-2 pointer-events-auto shadow-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSubmit()
                }}
                className="flex items-center gap-2 pl-3"
              >
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !question.trim()}
                  className="w-9 h-9 rounded-full bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-40 disabled:bg-white/20 disabled:text-white flex items-center justify-center transition-all shrink-0 shadow-md"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <ArrowUp className="w-4 h-4 text-slate-950" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Citation Detail Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  )
}
