import React from 'react'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { GroundingCoverage } from '../../types/query'
import { cn } from '../../lib/utils'

interface CoverageBadgeProps {
  coverage: GroundingCoverage
  className?: string
}

export const CoverageBadge: React.FC<CoverageBadgeProps> = ({ coverage, className }) => {
  switch (coverage) {
    case 'supported':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200',
            className
          )}
          title="Answer is directly supported by evidence in indexed notes"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Supported by Notes
        </span>
      )
    case 'partial':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200',
            className
          )}
          title="Answer is partially supported with some inferences or knowledge gaps"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          Partially Supported
        </span>
      )
    case 'no_evidence_found':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300',
            className
          )}
          title="No direct evidence found in indexed notes for this question"
        >
          <ShieldX className="w-3.5 h-3.5 text-slate-500" />
          No Direct Evidence
        </span>
      )
  }
}
