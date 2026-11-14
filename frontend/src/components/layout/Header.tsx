import React from 'react'
import { Sparkles } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <header className="h-16 px-8 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Local Privacy Active</span>
        </div>
      </div>
    </header>
  )
}
