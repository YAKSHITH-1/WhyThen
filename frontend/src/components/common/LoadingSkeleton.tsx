import React from 'react'
import { cn } from '../../lib/utils'

interface LoadingSkeletonProps {
  className?: string
}

export const Skeleton: React.FC<LoadingSkeletonProps> = ({ className }) => {
  return <div className={cn('animate-pulse rounded bg-slate-200/80', className)} />
}

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-lg">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/8 ml-auto" />
        </div>
      ))}
    </div>
  )
}
