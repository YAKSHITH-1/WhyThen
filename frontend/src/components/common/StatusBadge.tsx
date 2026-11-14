import React from 'react'
import { DocumentStatus } from '../../types/document'
import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: DocumentStatus
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const styles: Record<DocumentStatus, string> = {
    indexed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    modified: 'bg-blue-50 text-blue-700 border-blue-200',
    removed: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  const labels: Record<DocumentStatus, string> = {
    indexed: 'Indexed',
    modified: 'Modified',
    removed: 'Removed',
    failed: 'Failed',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border uppercase tracking-wider',
        styles[status] || styles.indexed,
        className
      )}
    >
      {labels[status] || status}
    </span>
  )
}
