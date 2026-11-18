import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquareText,
  GitBranch,
  FolderArchive,
  Settings,
  Cpu,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { dashboardService } from '../../services/dashboardService'
import { HealthStatusResponse } from '../../types/dashboard'

interface SidebarProps {
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const [health, setHealth] = useState<HealthStatusResponse | null>(null)

  useEffect(() => {
    let mounted = true
    const checkHealth = async () => {
      try {
        const data = await dashboardService.getHealth()
        if (mounted) setHealth(data)
      } catch {
        if (mounted) {
          setHealth({
            status: 'error',
            app: 'WhyThen',
            version: '0.1.0',
            database: 'offline',
            ollama: 'offline',
          })
        }
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'System overview & search',
    },
    {
      to: '/ask',
      label: 'Ask WhyThen',
      icon: MessageSquareText,
      description: 'Grounded memory QA',
    },
    {
      to: '/timeline',
      label: 'Decision Timeline',
      icon: GitBranch,
      description: 'Reasoning & evolution',
    },
    {
      to: '/sources',
      label: 'Knowledge Sources',
      icon: FolderArchive,
      description: 'Files & indexing status',
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      description: 'LLM & RAG parameters',
    },
  ]

  return (
    <aside
      className={cn(
        'w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 flex-shrink-0 h-screen sticky top-0',
        className
      )}
    >
      {/* Brand Header */}
      <div>
        <div className="px-6 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-[0_2px_10px_rgba(255,255,255,0.25)] font-bold text-sm">
              W
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                WhyThen
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-200 border border-white/15">
                  MVP
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 leading-tight">
                Personal Decision Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'glass-surface-active'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-all duration-200',
                      isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] scale-105' : 'text-slate-400'
                    )}
                  />
                  <div className="flex flex-col text-left">
                    <span className={cn(isActive && 'tracking-wide font-medium')}>{item.label}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Health & Engine Status Bar */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5" />
              SQLite DB
            </span>
            <span
              className={cn(
                'flex items-center gap-1 font-medium capitalize',
                health?.database === 'connected' ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {health?.database === 'connected' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3 h-3 text-rose-400" />
              )}
              {health?.database || 'checking...'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="w-3.5 h-3.5" />
              Ollama Engine
            </span>
            <span
              className={cn(
                'flex items-center gap-1 font-medium capitalize',
                health?.ollama === 'connected' ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {health?.ollama === 'connected' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-400" />
              )}
              {health?.ollama || 'checking...'}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Local-First RAG</span>
          <span>v{health?.version || '0.1.0'}</span>
        </div>
      </div>
    </aside>
  )
}
